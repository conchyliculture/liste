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

PUBLIC_DIR = File.expand_path("public", __dir__)

# Ordre dans lequel trier les rayons (dans l'ordre d'arrivée au supermarché)
_rayons_default = [
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
$enum_rayon = begin
    JSON.parse(File.read(File.join(PUBLIC_DIR, "rayons.json")))
rescue Errno::ENOENT, JSON::ParserError
    _rayons_default
end

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
legacy_dir = File.expand_path("stored_recettes", __dir__)
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

SESSION_WATCHERS = {}
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
        SESSION_WATCHERS[session_id]&.each { |q| q.push(state) }
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

def validate_recette_data(j)
    liste_ingredients = JSON.parse(File.read(File.join(PUBLIC_DIR, "ingredients.json")))
    raise "No ingredients" if liste_ingredients.empty?
    raise "missing top key 'recettes'" unless j.has_key?("recettes")
    raise "No recette" if j['recettes'].empty?
    j['recettes'].each do |r|
        raise "missing key 'name' for a recette" unless r['name']
        raise "recette name empty" if r["name"].empty?
        raise "missing key 'ingredients' for a recette" unless r['ingredients']
        raise "recette ingredients empty" if r["ingredients"].empty?
        r["ingredients"].each do |ing|
            raise "missing key 'name' for ingredient in recette #{r['name']}" unless ing['name']
            raise "ingredient name empty in recette #{r['name']}" if ing["name"].empty?
            if ing.has_key?('qty')
                unless ing['qty'].is_a?(Float) || ing['qty'].is_a?(Integer)
                    raise "ingredient #{ing['name']} in recette #{r['name']} is not a number but #{ing['qty'].class}"
                end
            end
            unless liste_ingredients.has_key?(ing['name'])
                raise "ingredient #{ing['name']} in recette #{r['name']} is not in \"ingredients\" list"
            end
        end
    end
end

def validate_recette_json(path)
    validate_recette_data(JSON.parse(File.read(path)))
end

# ── Startup validation ────────────────────────────────────────────────────────

STARTUP_ERRORS = []
[File.join(PUBLIC_DIR, "recettes.json"), File.join(PUBLIC_DIR, "matin.json")].each do |path|
    validate_recette_json(path)
rescue JSON::ParserError, RuntimeError => e
    STARTUP_ERRORS << "Error in #{File.basename(path)}: #{e.message}"
end

before do
    @errors = STARTUP_ERRORS.dup
end

# ── Helpers ───────────────────────────────────────────────────────────────────

helpers do
    def json_endpoint
        yield
    rescue JSON::ParserError => e
        halt 400, "JSON invalide: #{e.message}"
    rescue ArgumentError, RuntimeError => e
        halt 400, e.message
    end

    def save_recettes_file(path, body)
        j = JSON.parse(body)
        validate_recette_data(j)
        File.write(path, JSON.pretty_generate(j))
        "ok"
    end
end

# ── Static data routes ────────────────────────────────────────────────────────

get '/recettes.json' do
    send_file File.join(PUBLIC_DIR, "recettes.json")
end

get '/matin.json' do
    send_file File.join(PUBLIC_DIR, "matin.json")
end

get '/ingredients' do
    j = JSON.parse(File.read(File.join(PUBLIC_DIR, "ingredients.json")))
    j.each { |_k, v| v["rayon"] = $enum_rayon.index(v["rayon"]) }
    JSON.generate(j)
end

get '/rayons' do
    content_type :json
    JSON.generate($enum_rayon)
end

post '/rayons/save' do
    json_endpoint do
        j = JSON.parse(request.body.read)
        raise ArgumentError, "Expected an array" unless j.is_a?(Array)
        raise ArgumentError, "Empty list" if j.empty?
        j.each { |r| raise ArgumentError, "Invalid rayon" unless r.is_a?(String) && !r.strip.empty? }
        $enum_rayon = j
        File.write(File.join(PUBLIC_DIR, "rayons.json"), JSON.pretty_generate(j))
        "ok"
    end
end

get '/ingredients/raw' do
    content_type :json
    File.read(File.join(PUBLIC_DIR, "ingredients.json"))
end

post '/ingredients/save' do
    json_endpoint do
        j = JSON.parse(request.body.read)
        raise ArgumentError, "Expected an object" unless j.is_a?(Hash)
        raise ArgumentError, "Empty catalog" if j.empty?
        j.each do |name, v|
            raise ArgumentError, "Invalid entry for '#{name}'" unless v.is_a?(Hash)
            raise ArgumentError, "Missing rayon for '#{name}'" unless v['rayon'].is_a?(String) && !v['rayon'].empty?
            raise ArgumentError, "Unknown rayon '#{v['rayon']}' for '#{name}'" unless $enum_rayon.include?(v['rayon'])
            raise ArgumentError, "Invalid unit for '#{name}'" if v.key?('unit') && !v['unit'].is_a?(String)
        end
        File.write(File.join(PUBLIC_DIR, "ingredients.json"), JSON.pretty_generate(j.sort.to_h))
        "ok"
    end
end

get '/' do
    erb :main
end

get '/recettes-editor' do
    erb :recettes_editor
end

post '/recettes/save' do
    json_endpoint do
        save_recettes_file(File.join(PUBLIC_DIR, "recettes.json"), request.body.read)
    end
end

post '/matin/save' do
    json_endpoint do
        save_recettes_file(File.join(PUBLIC_DIR, "matin.json"), request.body.read)
    end
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
    json_endpoint do
        json = JSON.parse(request.body.read)
        nom  = json["name"].to_s
        raise ArgumentError, "Invalid name" unless nom =~ /\A[a-z0-9 ]+\z/i
        date = Time.now.strftime("%Y-%m-%dT%H-%M-%S")
        DB.execute(
            "INSERT INTO saved_lists (name, created_at, data) VALUES (?, ?, ?)",
            [nom, date, json["liste"].to_json]
        )
        "done"
    end
end

# ── Shopping mode ─────────────────────────────────────────────────────────────

post '/shopping-session' do
    json_endpoint do
        json  = JSON.parse(request.body.read)
        items = json["items"]
        raise ArgumentError, "items required" unless items.is_a?(Array)
        id    = SecureRandom.hex(8)
        date  = Time.now.strftime("%Y-%m-%dT%H-%M-%S")
        DB.execute(
            "INSERT INTO shopping_sessions (id, label, created_at, items) VALUES (?, ?, ?, ?)",
            [id, json["label"], date, items.to_json]
        )
        content_type :json
        { id: id, url: "/shop/#{id}" }.to_json
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
    initial    = session_state(session_id)
    halt 404, "Session introuvable" unless initial

    unless nick.empty?
        DB.execute(<<~SQL, [session_id, nick])
            INSERT INTO session_presence (session_id, nickname, last_seen) VALUES (?, ?, datetime('now'))
            ON CONFLICT(session_id, nickname) DO UPDATE SET last_seen = datetime('now')
        SQL
    end

    queue = Queue.new
    SESSION_MUTEX.synchronize { (SESSION_WATCHERS[session_id] ||= []) << queue }
    begin
        result = begin; queue.pop(timeout: EVENTS_TIMEOUT); rescue ThreadError; nil; end
        content_type :json
        headers 'Cache-Control' => 'no-store'
        (result || initial).to_json
    ensure
        SESSION_MUTEX.synchronize do
            SESSION_WATCHERS[session_id]&.delete(queue)
            SESSION_WATCHERS.delete(session_id) if SESSION_WATCHERS[session_id]&.empty?
        end
    end
end

post '/shop/:id/check' do
    json_endpoint do
        session_id = params[:id]
        json       = JSON.parse(request.body.read)
        item_name  = json["item_name"].to_s
        nickname   = json["nickname"].to_s.strip
        raise ArgumentError, "item_name required" if item_name.empty?
        raise ArgumentError, "nickname required"  if nickname.empty?

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
    end
end

post '/shop/:id/override' do
    session_id = params[:id]
    halt 404, "Session introuvable" unless DB.execute(
        "SELECT 1 FROM shopping_sessions WHERE id = ?", [session_id]
    ).first
    json_endpoint do
        json      = JSON.parse(request.body.read)
        item_name = json["item_name"].to_s
        raise ArgumentError, "item_name required" if item_name.empty?

        DB.execute(<<~SQL, [session_id, item_name, json["rayon"], json["qty_display"], json["is_deleted"] ? 1 : 0, json["nickname"]])
            INSERT INTO session_overrides (session_id, item_name, rayon, qty_display, is_deleted, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id, item_name) DO UPDATE SET
                rayon=excluded.rayon, qty_display=excluded.qty_display,
                is_deleted=excluded.is_deleted, created_by=excluded.created_by
        SQL
        broadcast_state(session_id)
        "ok"
    end
end
