#!/usr/bin/ruby
# encoding: utf-8
require "json"
require "test/unit"
require 'rack/test'

ENV["DB_PATH"] = ":memory:"
ENV["EVENTS_TIMEOUT"] = "0"
require_relative "../liste.rb"

class TestListe < Test::Unit::TestCase
    include Rack::Test::Methods

    $test_liste = {
        "name" => "lolilol",
        "liste" => {
            "jours" => [
                {"matin" => {"recette" => "", "gens" => 10}, "dejeuner" => {"recette" => "Omelette", "gens" => 10}, "diner" => {"recette" => "", "gens" => 10}},
                {"matin" => {"recette" => "", "gens" => 10}, "dejeuner" => {"recette" => "Croziflette", "gens" => 10}, "diner" => {"recette" => "", "gens" => 10}},
            ],
            "extras" => [],
            "extras_txt" => ""
        }
    }

    $test_items = [
        {"rayon" => "FLEG",     "name" => "Carottes",  "qty_display" => "1.2kg"},
        {"rayon" => "Épicerie", "name" => "Sel",       "qty_display" => ""},
        {"rayon" => "Alcool",   "name" => "Vin rouge", "qty_display" => "3L"},
    ]

    def setup
        DB.execute("DELETE FROM checked_items")
        DB.execute("DELETE FROM session_overrides")
        DB.execute("DELETE FROM session_presence")
        DB.execute("DELETE FROM shopping_sessions")
        DB.execute("DELETE FROM saved_lists")
    end

    def app
        Sinatra::Application
    end

    def json_post(path, body)
        post path, body.to_json, {'CONTENT_TYPE' => 'application/json'}
    end

    def json_body
        JSON.parse(last_response.body)
    end

    # ── Recipe data validation ─────────────────────────────────────────────────

    def test_recettes
        ingredients_path = File.join(File.dirname(File.realpath(__FILE__)), "..", "public", "ingredients.json")
        recettes_path    = File.join(File.dirname(File.realpath(__FILE__)), "..", "public", "recettes.json")
        ingredients = JSON.parse(File.open(ingredients_path).read())
        recettes    = JSON.parse(File.open(recettes_path).read())
        ingredients_list = ingredients.keys
        recettes["recettes"].each do |recette|
            recette["ingredients"].each do |i|
                assert ingredients_list.include?(i["name"]), "Plz add ingredient #{i['name']} in ingredients.json"
            end
        end
        ingredients.each do |ingredient_name, reste|
            assert reste["rayon"] != nil
        end
    end

    # ── Static routes ──────────────────────────────────────────────────────────

    def test_it_gives_index
        get '/'
        assert last_response.ok?
        assert_include last_response.body, 'x-data="listeApp()"'
    end

    def test_it_gives_recettes
        get '/recettes.json'
        assert last_response.ok?
        j = JSON.parse(last_response.body)
        assert j['recettes'].size > 5
        assert_match(/^[a-z ]+$/i, j['recettes'][0]["name"])
        assert j['recettes'][0]["ingredients"].size > 3
    end

    # ── Saved lists ────────────────────────────────────────────────────────────

    def test_it_saves_list
        json_post '/save', $test_liste
        assert last_response.ok?, "Expected 200, got #{last_response.status}: #{last_response.body}"
        assert_equal "done", last_response.body

        row = DB.execute("SELECT name, data FROM saved_lists").first
        assert_equal "lolilol", row["name"]
        data = JSON.parse(row["data"])
        assert_equal 2, data["jours"].size
    end

    def test_it_saves_and_restores_custom_items_and_adjustments
        liste = $test_liste.merge("liste" => $test_liste["liste"].merge(
            "custom_items"    => [{"name" => "Sel", "qty" => 1, "unit" => "kg", "rayon" => 8}],
            "qty_adjustments" => {"Oeufs" => 3}
        ))
        json_post '/save', liste
        assert last_response.ok?

        get '/get-stored-listes'
        rows = JSON.parse(last_response.body)
        data = rows.first["liste"]
        assert_equal [{"name" => "Sel", "qty" => 1, "unit" => "kg", "rayon" => 8}], data["custom_items"]
        assert_equal({"Oeufs" => 3}, data["qty_adjustments"])
    end

    def test_it_gives_stored_lists
        DB.execute("INSERT INTO saved_lists (name, created_at, data) VALUES (?, ?, ?)",
                   ["test", "2026-01-01T00-00-00", {jours: []}.to_json])
        get '/get-stored-listes'
        assert last_response.ok?
        rows = JSON.parse(last_response.body)
        assert_equal 1, rows.size
        assert_equal "test", rows[0]["name"]
        assert_equal "2026-01-01T00-00-00", rows[0]["date"]
    end

    def test_it_rejects_invalid_name
        json_post '/save', $test_liste.merge("name" => "../../etc/passwd")
        assert_equal 400, last_response.status
    end

    # ── /recettes/save ─────────────────────────────────────────────────────────

    def test_recettes_save_valid
        original = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        json_post '/recettes/save', JSON.parse(original)
        assert last_response.ok?, "Expected 200, got #{last_response.status}: #{last_response.body}"
        assert_equal "ok", last_response.body
    ensure
        File.write(File.join(PUBLIC_DIR, "recettes.json"), original) if original
    end

    def test_recettes_save_invalid_json
        post '/recettes/save', "{bad json", {'CONTENT_TYPE' => 'application/json'}
        assert_equal 400, last_response.status
        assert_include last_response.body, "JSON invalide"
    end

    def test_recettes_save_with_instructions
        original = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        j = JSON.parse(original)
        j["recettes"][0]["instructions"] = "1. Faire revenir les oignons\n2. Ajouter le sel"
        json_post '/recettes/save', j
        assert last_response.ok?, "Expected 200, got #{last_response.status}: #{last_response.body}"
        saved = JSON.parse(File.read(File.join(PUBLIC_DIR, "recettes.json")))
        assert_equal "1. Faire revenir les oignons\n2. Ajouter le sel", saved["recettes"][0]["instructions"]
    ensure
        File.write(File.join(PUBLIC_DIR, "recettes.json"), original) if original
    end

    def test_recettes_save_rejects_non_string_instructions
        original = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        j = JSON.parse(original)
        j["recettes"][0]["instructions"] = ["not", "a", "string"]
        json_post '/recettes/save', j
        assert_equal 400, last_response.status
        assert_include last_response.body, "instructions"
        assert_equal original, File.read(File.join(PUBLIC_DIR, "recettes.json")), "File must not be modified on error"
    ensure
        File.write(File.join(PUBLIC_DIR, "recettes.json"), original) if original
    end

    def test_recettes_save_unknown_ingredient
        original = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        bad = {"recettes" => [{"name" => "Test", "ingredients" => [{"name" => "__no_such_ingredient__", "qty" => 1}]}]}
        json_post '/recettes/save', bad
        assert_equal 400, last_response.status
        assert_include last_response.body, "not in"
        assert_equal original, File.read(File.join(PUBLIC_DIR, "recettes.json")), "File must not be modified on error"
    ensure
        File.write(File.join(PUBLIC_DIR, "recettes.json"), original) if original
    end

    def test_recettes_save_missing_recettes_key
        original = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        json_post '/recettes/save', {"not_recettes" => []}
        assert_equal 400, last_response.status
        assert_equal original, File.read(File.join(PUBLIC_DIR, "recettes.json")), "File must not be modified on error"
    ensure
        File.write(File.join(PUBLIC_DIR, "recettes.json"), original) if original
    end

    # ── /matin/save ────────────────────────────────────────────────────────────

    def test_matin_save_valid
        original = File.read(File.join(PUBLIC_DIR, "matin.json"))
        json_post '/matin/save', JSON.parse(original)
        assert last_response.ok?, "Expected 200, got #{last_response.status}: #{last_response.body}"
        assert_equal "ok", last_response.body
    ensure
        File.write(File.join(PUBLIC_DIR, "matin.json"), original) if original
    end

    def test_matin_save_invalid_json
        post '/matin/save', "{bad json", {'CONTENT_TYPE' => 'application/json'}
        assert_equal 400, last_response.status
        assert_include last_response.body, "JSON invalide"
    end

    def test_matin_save_with_instructions
        original = File.read(File.join(PUBLIC_DIR, "matin.json"))
        j = JSON.parse(original)
        j["recettes"][0]["instructions"] = "Préparer **les tartines** au beurre."
        json_post '/matin/save', j
        assert last_response.ok?, "Expected 200, got #{last_response.status}: #{last_response.body}"
        saved = JSON.parse(File.read(File.join(PUBLIC_DIR, "matin.json")))
        assert_equal "Préparer **les tartines** au beurre.", saved["recettes"][0]["instructions"]
    ensure
        File.write(File.join(PUBLIC_DIR, "matin.json"), original) if original
    end

    def test_matin_save_rejects_non_string_instructions
        original = File.read(File.join(PUBLIC_DIR, "matin.json"))
        j = JSON.parse(original)
        j["recettes"][0]["instructions"] = 42
        json_post '/matin/save', j
        assert_equal 400, last_response.status
        assert_include last_response.body, "instructions"
        assert_equal original, File.read(File.join(PUBLIC_DIR, "matin.json")), "File must not be modified on error"
    ensure
        File.write(File.join(PUBLIC_DIR, "matin.json"), original) if original
    end

    def test_matin_save_schema_error
        original = File.read(File.join(PUBLIC_DIR, "matin.json"))
        json_post '/matin/save', {"recettes" => [{"name" => "T", "ingredients" => [{"name" => "__ghost__", "qty" => 1}]}]}
        assert_equal 400, last_response.status
        assert_equal original, File.read(File.join(PUBLIC_DIR, "matin.json")), "File must not be modified on error"
    ensure
        File.write(File.join(PUBLIC_DIR, "matin.json"), original) if original
    end

    # ── /ingredients/save ──────────────────────────────────────────────────────

    def test_ingredients_save_valid
        original = File.read(File.join(PUBLIC_DIR, "ingredients.json"))
        json_post '/ingredients/save', JSON.parse(original)
        assert last_response.ok?, "Expected 200, got #{last_response.status}: #{last_response.body}"
        assert_equal "ok", last_response.body
    ensure
        File.write(File.join(PUBLIC_DIR, "ingredients.json"), original) if original
    end

    def test_ingredients_save_invalid_json
        post '/ingredients/save', "{bad json", {'CONTENT_TYPE' => 'application/json'}
        assert_equal 400, last_response.status
        assert_include last_response.body, "JSON invalide"
    end

    def test_ingredients_save_unknown_rayon
        original = File.read(File.join(PUBLIC_DIR, "ingredients.json"))
        bad = JSON.parse(original).merge("__test_ing__" => {"rayon" => "__no_such_rayon__"})
        json_post '/ingredients/save', bad
        assert_equal 400, last_response.status
        assert_include last_response.body, "Unknown rayon"
        assert_equal original, File.read(File.join(PUBLIC_DIR, "ingredients.json")), "File must not be modified on error"
    ensure
        File.write(File.join(PUBLIC_DIR, "ingredients.json"), original) if original
    end

    def test_ingredients_save_not_an_object
        post '/ingredients/save', "[]", {'CONTENT_TYPE' => 'application/json'}
        assert_equal 400, last_response.status
    end

    # ── /rayons/save ───────────────────────────────────────────────────────────

    def test_rayons_save_valid
        original = File.read(File.join(PUBLIC_DIR, "rayons.json"))
        json_post '/rayons/save', JSON.parse(original)
        assert last_response.ok?, "Expected 200, got #{last_response.status}: #{last_response.body}"
        assert_equal "ok", last_response.body
    ensure
        File.write(File.join(PUBLIC_DIR, "rayons.json"), original) if original
    end

    def test_rayons_save_invalid_json
        post '/rayons/save', "{bad json", {'CONTENT_TYPE' => 'application/json'}
        assert_equal 400, last_response.status
        assert_include last_response.body, "JSON invalide"
    end

    def test_rayons_save_empty_array
        original = File.read(File.join(PUBLIC_DIR, "rayons.json"))
        json_post '/rayons/save', []
        assert_equal 400, last_response.status
    ensure
        File.write(File.join(PUBLIC_DIR, "rayons.json"), original) if original
    end

    def test_rayons_save_not_an_array
        original = File.read(File.join(PUBLIC_DIR, "rayons.json"))
        json_post '/rayons/save', {"rayon" => "FLEG"}
        assert_equal 400, last_response.status
    ensure
        File.write(File.join(PUBLIC_DIR, "rayons.json"), original) if original
    end

    # ── Shopping sessions ──────────────────────────────────────────────────────

    def make_session
        json_post '/shopping-session', {items: $test_items, label: "Test session"}
        assert last_response.ok?, last_response.body
        json_body["id"]
    end

    def test_it_creates_shopping_session
        sid = make_session
        assert_not_nil sid
        assert_equal "/shop/#{sid}", json_body["url"]
        row = DB.execute("SELECT label FROM shopping_sessions WHERE id = ?", [sid]).first
        assert_equal "Test session", row["label"]
    end

    def test_it_gives_shop_page
        sid = make_session
        get "/shop/#{sid}"
        assert last_response.ok?
        assert_include last_response.body, sid
    end

    def test_it_gives_shop_state
        sid = make_session
        get "/shop/#{sid}/state"
        assert last_response.ok?
        state = json_body
        assert_equal 3, state["items"].size
        assert_equal [], state["checked"]
        assert_equal [], state["overrides"]
    end

    def test_it_checks_item
        sid = make_session
        json_post "/shop/#{sid}/check", {item_name: "Carottes", nickname: "Alice"}
        assert last_response.ok?

        get "/shop/#{sid}/state"
        state = json_body
        checked = state["checked"].find { |c| c["item_name"] == "Carottes" }
        assert_not_nil checked
        assert_equal "Alice", checked["checked_by"]
    end

    def test_it_unchecks_item
        sid = make_session
        json_post "/shop/#{sid}/check", {item_name: "Carottes", nickname: "Alice"}
        json_post "/shop/#{sid}/check", {item_name: "Carottes", nickname: "Alice"}

        get "/shop/#{sid}/state"
        checked = json_body["checked"].find { |c| c["item_name"] == "Carottes" }
        assert_nil checked, "Item should be unchecked after second toggle"
    end

    def test_it_adds_override_item
        sid = make_session
        json_post "/shop/#{sid}/override", {
            item_name: "Beurre", rayon: "Frais", qty_display: "250g", is_deleted: false, nickname: "Bob"
        }
        assert last_response.ok?

        get "/shop/#{sid}/state"
        added = json_body["overrides"].find { |o| o["item_name"] == "Beurre" }
        assert_not_nil added
        assert_equal 0, added["is_deleted"]
        assert_equal "Bob", added["created_by"]
    end

    def test_it_deletes_item
        sid = make_session
        json_post "/shop/#{sid}/override", {
            item_name: "Carottes", is_deleted: true, nickname: "Bob"
        }
        assert last_response.ok?

        get "/shop/#{sid}/state"
        deleted = json_body["overrides"].find { |o| o["item_name"] == "Carottes" }
        assert_not_nil deleted
        assert_equal 1, deleted["is_deleted"]
    end

    def test_shop_404_for_unknown_session
        get '/shop/doesnotexist'
        assert_equal 404, last_response.status
    end

    def test_shop_events_returns_state
        sid = make_session
        get "/shop/#{sid}/events?nickname=Alice"
        assert last_response.ok?, last_response.body
        state = json_body
        assert state.key?("label")
        assert state.key?("items")
        assert state.key?("checked")
        assert state.key?("overrides")
        assert state.key?("shoppers")
    end

    def test_shop_events_updates_presence
        sid = make_session
        get "/shop/#{sid}/events?nickname=Alice"
        assert last_response.ok?
        row = DB.execute(
            "SELECT nickname FROM session_presence WHERE session_id = ? AND nickname = ?",
            [sid, "Alice"]
        ).first
        assert_not_nil row, "Alice should appear in session_presence after connecting"
    end

    def test_shop_events_404_for_unknown_session
        get '/shop/doesnotexist/events?nickname=Alice'
        assert_equal 404, last_response.status
    end

    # ── Cook view ──────────────────────────────────────────────────────────────

    def test_cook_renders_for_existing_list
        json_post '/save', $test_liste
        assert last_response.ok?
        id = DB.execute("SELECT id FROM saved_lists ORDER BY id DESC LIMIT 1").first["id"]

        get "/cook/#{id}"
        assert last_response.ok?, "Expected 200, got #{last_response.status}: #{last_response.body}"
        assert_include last_response.body, "lolilol"
        assert_include last_response.body, 'x-data="cookApp()"'
    end

    def test_cook_404_for_unknown_list
        get '/cook/9999999'
        assert_equal 404, last_response.status
    end
end
