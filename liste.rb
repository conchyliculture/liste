#!/usr/bin/ruby
# encoding: utf-8

require "erb"
require "json"
require "sinatra"
require "sqlite3"
require "securerandom"

set :bind, "0.0.0.0"
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

set :protection, :except => [:json_csrf]
set :host_authorization, { permitted_hosts: [] }

# Ordre dans lequel trier les rayons (dans l'ordre d'arrivée au supermarché)
$enum_rayon = [
    "FLEG", # Fruits et legumes
    "Poissonnerie",
    "Boucherie",
    "Volaille",
    "Charcuterie",
    "Frais",
    "Fromagerie",
    "Matin",
    "Épicerie",
    "Jus",
    "Alcool",
]

# ── Database ──────────────────────────────────────────────────────────────────

DB = SQLite3::Database.new(ENV.fetch("DB_PATH", "liste.db"))
DB.results_as_hash = true
DB.execute("PRAGMA foreign_keys = ON")
DB.execute_batch(<<~SQL)
    CREATE TABLE IF NOT EXISTS saved_lists (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data       TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shopping_sessions (
        id         TEXT PRIMARY KEY,
        label      TEXT,
        created_at TEXT NOT NULL,
        items      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checked_items (
        session_id TEXT NOT NULL REFERENCES shopping_sessions(id),
        item_name  TEXT NOT NULL,
        checked_by TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        PRIMARY KEY (session_id, item_name)
    );
    CREATE TABLE IF NOT EXISTS session_overrides (
        session_id  TEXT NOT NULL REFERENCES shopping_sessions(id),
        item_name   TEXT NOT NULL,
        rayon       TEXT,
        qty_display TEXT,
        is_deleted  INTEGER DEFAULT 0,
        created_by  TEXT,
        PRIMARY KEY (session_id, item_name)
    );
    CREATE TABLE IF NOT EXISTS session_presence (
        session_id TEXT NOT NULL REFERENCES shopping_sessions(id),
        nickname   TEXT NOT NULL,
        last_seen  TEXT NOT NULL,
        PRIMARY KEY (session_id, nickname)
    );
SQL

# Expire sessions older than 30 days (children first to satisfy FK constraints)
DB.execute_batch(<<~SQL)
    DELETE FROM checked_items     WHERE session_id IN (SELECT id FROM shopping_sessions WHERE created_at < datetime('now', '-30 days'));
    DELETE FROM session_overrides WHERE session_id IN (SELECT id FROM shopping_sessions WHERE created_at < datetime('now', '-30 days'));
    DELETE FROM session_presence  WHERE session_id IN (SELECT id FROM shopping_sessions WHERE created_at < datetime('now', '-30 days'));
    DELETE FROM shopping_sessions WHERE created_at < datetime('now', '-30 days');
SQL

# One-time migration: import any existing stored_recettes/*.json files
legacy_dir = File.absolute_path(File.join(File.dirname(__FILE__), "stored_recettes"))
if File.exist?(legacy_dir)
    Dir.glob(File.join(legacy_dir, "*.json")).each do |path|
        begin
            j = JSON.parse(File.read(path))
            DB.execute(
                "INSERT OR IGNORE INTO saved_lists (name, created_at, data) VALUES (?, ?, ?)",
                [j["name"], j["date"], j.fetch("liste", j).to_json]
            )
        rescue => e
            $stderr.puts "Migration: skipping #{path}: #{e.message}"
        end
    end
end

# ── Shopping push (long-poll) registry ────────────────────────────────────────

SESSION_WATCHERS = Hash.new { |h, k| h[k] = [] }
SESSION_MUTEX = Mutex.new
EVENTS_TIMEOUT = ENV.fetch("EVENTS_TIMEOUT", "20").to_i

# Wake all long-poll threads on shutdown so the server exits promptly
_wake_all = proc { SESSION_WATCHERS.each_value { |qs| qs.each { |q| q.push(nil) rescue nil } } }
[:INT, :TERM].each do |sig|
    prev = Signal.trap(sig) { _wake_all.call; prev.call if prev.respond_to?(:call) }
end

def broadcast_state(session_id)
    state = session_state(session_id)
    SESSION_MUTEX.synchronize do
        SESSION_WATCHERS[session_id].each { |q| q.push(state) }
    end
end

def session_state(session_id)
    session = DB.execute("SELECT label, items FROM shopping_sessions WHERE id = ?", [session_id]).first
    return nil unless session
    checked = DB.execute(
        "SELECT item_name, checked_by FROM checked_items WHERE session_id = ?", [session_id]
    )
    overrides = DB.execute(
        "SELECT item_name, rayon, qty_display, is_deleted, created_by FROM session_overrides WHERE session_id = ?",
        [session_id]
    )
    shoppers = DB.execute(
        "SELECT nickname FROM session_presence WHERE session_id = ? AND last_seen > datetime('now', '-30 seconds')",
        [session_id]
    ).map { |r| r["nickname"] }
    {
        label:     session["label"],
        items:     JSON.parse(session["items"]),
        checked:   checked.map  { |r| { item_name: r["item_name"], checked_by: r["checked_by"] } },
        overrides: overrides.map { |r| {
            item_name:   r["item_name"],
            rayon:       r["rayon"],
            qty_display: r["qty_display"],
            is_deleted:  r["is_deleted"],
            created_by:  r["created_by"]
        }},
        shoppers:  shoppers
    }
end

# ── Recipe validation ─────────────────────────────────────────────────────────

def add_error(msg)
    (@error_list ||= []) << msg
    @errormsg = "<h2 class=\"md-toolbar-tools\">"
    @error_list.each do |m|
        @errormsg << "<span>#{m}</span>"
    end
    @errormsg << "</h2>"
end

def validate_recette_json(path)
    j = JSON.parse(File.read(path))
    ings_path = File.absolute_path(File.join(File.dirname(__FILE__),"public","ingredients.json"))
    begin
        liste_ingredients = JSON.parse(File.read(ings_path))
    rescue JSON::ParserError => e
        $stderr.puts e
        add_error("Error parsing JSON file #{ings_path}")
        raise e
    end
    raise "No ingredients" if liste_ingredients.size == 0
    unless j.has_key?("recettes")
        raise "missing top key 'recettes'"
    end
    raise "No recette" if j['recettes'].size == 0
    j['recettes'].each do |r|
        raise "missing key 'name' for a recette" unless r['name']
        raise "recette name empty" if r["name"].empty?
        raise "missing key 'ingredients' for a recette" unless r['ingredients']
        raise "recette ingredients empty" if r["ingredients"].empty?
        r["ingredients"].each do |ing|
            raise "missing key 'name' for ingredient in recette #{r['name']}" unless ing['name']
            raise "ingredient name empty in recette #{r['name']}" if ing["name"].empty?
            if ing.has_key?('qty')
                raise "ingredient #{ing['name']} in recette #{r['name']} is not a number but #{ing['qty'].class}" unless (ing['qty'].class == Float or ing['qty'].class == Integer)
            end
            if ing.has_key?('unit')
                raise "bad unit '#{ing["unit"]}' for ingredient #{ing['name']} in recette #{r['name']}" unless ["g", "cL", "L", " tranche(s)"].include?(ing["unit"])
            end
            if not liste_ingredients.has_key?(ing['name'])
                raise "ingredient #{ing['name']} in recette #{r['name']} is not in \"ingredients\" list"
            end
        end
    end
end

recettes_json = [
    File.absolute_path(File.join(File.dirname(__FILE__),"public","recettes.json")),
    File.absolute_path(File.join(File.dirname(__FILE__),"public","matin.json"))
]
recettes_json.each do |path|
    begin
        validate_recette_json(path)
    rescue JSON::ParserError => e
        add_error("Error parsing JSON file #{path}")
    rescue RuntimeError =>e
        add_error("Error parsing JSON file #{path}: #{e.message}")
    end
end

before do
    @error_list = []
    @errormsg = ""
end

# ── Static data routes ────────────────────────────────────────────────────────

get '/recettes.json' do
    send_file File.absolute_path(File.join(File.dirname(__FILE__),"public","recettes.json"))
end

get '/matin.json' do
    send_file File.absolute_path(File.join(File.dirname(__FILE__),"public","matin.json"))
end

get '/ingredients' do
    ings_path = File.absolute_path(File.join(File.dirname(__FILE__),"public","ingredients.json"))
    j = JSON.parse(File.read(ings_path))
    j.each{|k,v| v["rayon"] = $enum_rayon.index(v["rayon"])}
    JSON.generate(j)
end

get '/' do
    erb :main
end

# ── Saved lists ───────────────────────────────────────────────────────────────

get '/get-stored-listes' do
    content_type :json
    rows = DB.execute("SELECT id, name, created_at, data FROM saved_lists ORDER BY created_at DESC")
    rows.map { |r|
        d = JSON.parse(r["data"]) rescue {}
        { "id" => r["id"], "name" => r["name"], "date" => r["created_at"], "liste" => d }
    }.to_json
end

post '/save' do
    begin
        json = JSON.parse(request.body.read)
        nom  = json["name"].to_s
        raise "Invalid name" unless nom =~ /\A[a-z0-9 ]+\z/i
        date = Time.now.strftime("%Y-%m-%dT%H-%M-%S")
        DB.execute(
            "INSERT INTO saved_lists (name, created_at, data) VALUES (?, ?, ?)",
            [nom, date, json["liste"].to_json]
        )
        "done"
    rescue => e
        status 500
        "Couldn't save: #{e.message}"
    end
end

# ── Shopping mode ─────────────────────────────────────────────────────────────

post '/shopping-session' do
    begin
        json  = JSON.parse(request.body.read)
        items = json["items"]
        raise "items required" unless items.is_a?(Array)
        id    = SecureRandom.hex(8)
        date  = Time.now.strftime("%Y-%m-%dT%H-%M-%S")
        DB.execute(
            "INSERT INTO shopping_sessions (id, label, created_at, items) VALUES (?, ?, ?, ?)",
            [id, json["label"], date, items.to_json]
        )
        content_type :json
        { id: id, url: "/shop/#{id}" }.to_json
    rescue => e
        status 500
        e.message
    end
end

get '/shop/:id' do
    @session_id = params[:id]
    halt 404, "Session introuvable" unless DB.execute(
        "SELECT 1 FROM shopping_sessions WHERE id = ?", [@session_id]
    ).first
    erb :shop
end

get '/shop/:id/state' do
    content_type :json
    headers 'Cache-Control' => 'no-store'
    state = session_state(params[:id])
    halt 404, "Session introuvable" unless state
    state.to_json
end

get '/shop/:id/events' do
    session_id = params[:id]
    nick       = params[:nickname].to_s.strip
    halt 404, "Session introuvable" unless session_state(session_id)

    unless nick.empty?
        DB.execute(<<~SQL, [session_id, nick])
            INSERT INTO session_presence (session_id, nickname, last_seen) VALUES (?, ?, datetime('now'))
            ON CONFLICT(session_id, nickname) DO UPDATE SET last_seen = datetime('now')
        SQL
    end

    queue = Queue.new
    SESSION_MUTEX.synchronize { SESSION_WATCHERS[session_id] << queue }
    begin
        result = begin; queue.pop(timeout: EVENTS_TIMEOUT); rescue ThreadError; nil; end
        content_type :json
        headers 'Cache-Control' => 'no-store'
        (result || session_state(session_id)).to_json
    ensure
        SESSION_MUTEX.synchronize do
            SESSION_WATCHERS[session_id].delete(queue)
            SESSION_WATCHERS.delete(session_id) if SESSION_WATCHERS[session_id].empty?
        end
    end
end

post '/shop/:id/check' do
    begin
        session_id = params[:id]
        json = JSON.parse(request.body.read)
        item_name  = json["item_name"].to_s
        nickname   = json["nickname"].to_s.strip
        raise "item_name required" if item_name.empty?
        raise "nickname required"  if nickname.empty?

        existing = DB.execute(
            "SELECT 1 FROM checked_items WHERE session_id = ? AND item_name = ?",
            [session_id, item_name]
        ).first

        if existing
            DB.execute("DELETE FROM checked_items WHERE session_id = ? AND item_name = ?",
                       [session_id, item_name])
        else
            DB.execute(
                "INSERT INTO checked_items (session_id, item_name, checked_by, checked_at) VALUES (?, ?, ?, ?)",
                [session_id, item_name, nickname, Time.now.iso8601]
            )
        end
        broadcast_state(session_id)
        "ok"
    rescue => e
        status 500
        e.message
    end
end

post '/shop/:id/override' do
    begin
        session_id = params[:id]
        halt 404, "Session introuvable" unless DB.execute(
            "SELECT 1 FROM shopping_sessions WHERE id = ?", [session_id]
        ).first
        json = JSON.parse(request.body.read)
        item_name = json["item_name"].to_s
        raise "item_name required" if item_name.empty?

        DB.execute(<<~SQL, [session_id, item_name, json["rayon"], json["qty_display"], json["is_deleted"] ? 1 : 0, json["nickname"]])
            INSERT INTO session_overrides (session_id, item_name, rayon, qty_display, is_deleted, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id, item_name) DO UPDATE SET
                rayon=excluded.rayon, qty_display=excluded.qty_display,
                is_deleted=excluded.is_deleted, created_by=excluded.created_by
        SQL
        broadcast_state(session_id)
        "ok"
    rescue => e
        status 500
        e.message
    end
end
