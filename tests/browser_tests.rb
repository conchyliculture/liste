#!/usr/bin/ruby
# encoding: utf-8
require "json"
require "test/unit"
require "capybara"
require "capybara/dsl"
require "selenium-webdriver"

ENV["DB_PATH"]         = ":memory:"
ENV["EVENTS_TIMEOUT"]  = "0"
require_relative "../liste.rb"

Capybara.app    = Sinatra::Application
Capybara.server = :webrick
Capybara.default_max_wait_time = 6

Capybara.register_driver :headless_chrome do |app|
    opts = Selenium::WebDriver::Chrome::Options.new
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,900")   # above 960px breakpoint — list-aside visible
    Capybara::Selenium::Driver.new(app, browser: :chrome, options: opts)
end
Capybara.default_driver = :headless_chrome

class BrowserTests < Test::Unit::TestCase
    include Capybara::DSL

    $browser_test_items = [
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
        Capybara.reset_sessions!
    end

    def teardown
        Capybara.reset_sessions!
    end

    def make_session(items: $browser_test_items, label: "Test session")
        id   = SecureRandom.hex(8)
        date = Time.now.utc.iso8601
        DB.execute(
            "INSERT INTO shopping_sessions (id, label, created_at, items) VALUES (?, ?, ?, ?)",
            [id, label, date, items.to_json]
        )
        id
    end

    def make_saved_list
        liste = {
            "jours" => [
                {"matin"    => {"recette" => "",         "gens" => 10},
                 "dejeuner" => {"recette" => "Omelette", "gens" => 10},
                 "diner"    => {"recette" => "",         "gens" => 10}}
            ],
            "extras" => [], "extras_txt" => ""
        }
        DB.execute(
            "INSERT INTO saved_lists (name, created_at, data) VALUES (?, ?, ?)",
            ["Test list", Time.now.utc.iso8601, liste.to_json]
        )
        DB.execute("SELECT id FROM saved_lists ORDER BY id DESC LIMIT 1").first["id"]
    end

    # ── Main planner ──────────────────────────────────────────────────────────

    def test_planner_loads
        visit "/"
        assert_selector ".brand-text", text: "Liste de courses"
        assert_selector ".planner"
    end

    def test_planner_select_recipe_updates_list
        visit "/"
        # wait for recipes to load into selects
        assert_selector "select.meal-select option:not([value=''])", minimum: 1
        first("select.meal-select").find("option:not([value=''])", match: :first).select_option
        assert_selector ".rayon-items .liste-item", minimum: 1
    end

    def test_planner_add_custom_item
        visit "/"
        fill_in class: "ai-name", with: "Baguette"
        find(".ai-add").click
        assert_selector ".custom-item .ci-name", text: "Baguette"
    end

    def test_planner_save_list
        visit "/"
        # wait for data to load (button is :disabled="!ready" until then)
        assert_selector "select.meal-select option:not([value=''])", minimum: 1
        find(".topbar-actions .btn-ghost", text: /Sauver/).click
        assert_selector ".modal-card h2", text: "Sauvegarder"
        fill_in placeholder: "ex: Kinzout 2026", with: "Test save"
        find(".modal-card .btn-primary").click
        assert_selector ".toast", text: "sauvegardée"
    end

    def test_planner_load_list
        make_saved_list
        visit "/"
        assert_selector "select.meal-select option:not([value=''])", minimum: 1
        find(".topbar-actions .btn-ghost", text: /Charger/).click
        assert_selector ".modal-card h2", text: "Charger"
        find(".saved-item").click
        find(".modal-card .btn-primary", text: "Charger").click
        assert_selector ".toast", text: "chargée"
        assert_selector ".li-name", minimum: 1
    end

    def test_planner_remove_custom_item
        visit "/"
        fill_in class: "ai-name", with: "Baguette"
        find(".ai-add").click
        assert_selector ".custom-item .ci-name", text: "Baguette"
        find(".custom-item .x").click
        assert_no_selector ".custom-item .ci-name", text: "Baguette"
    end

    def test_planner_extras_checkbox
        visit "/"
        assert_selector "select.meal-select option:not([value=''])", minimum: 1
        first(".extras input[type='checkbox']").check
        assert_selector ".rayon-items .liste-item", minimum: 1
    end

    def test_planner_qty_adjustment
        visit "/"
        assert_selector "select.meal-select option:not([value=''])", minimum: 1
        first("select.meal-select").find("option:not([value=''])", match: :first).select_option
        assert_selector "[aria-label='+']", minimum: 1
        initial_qty = first(".qty-val").text
        first("[aria-label='+']").click
        assert_not_equal initial_qty, first(".qty-val").text
    end

    def test_planner_inline_qty_edit
        visit "/"
        assert_selector "select.meal-select option:not([value=''])", minimum: 1
        first("select.meal-select").find("option:not([value=''])", match: :first).select_option
        assert_selector ".qty-val", minimum: 1
        first(".qty-val").click
        assert_selector ".qty-input"
        find(".qty-input").send_keys(:escape)
        assert_no_selector ".qty-input"
    end

    def test_planner_change_days
        visit "/"
        assert_selector "select.meal-select option:not([value=''])", minimum: 1
        assert_selector ".days .day", count: 5
        nb_input = find("input.input[min='1'][max='20']")
        nb_input.set("3")
        nb_input.send_keys(:tab)
        assert_selector ".days .day", count: 3
    end

    def test_planner_shop_join_mode
        visit "/"
        assert_selector "select.meal-select option:not([value=''])", minimum: 1
        first("select.meal-select").find("option:not([value=''])", match: :first).select_option
        assert_selector ".liste-item", minimum: 1
        find(".btn-accent").click
        assert_selector ".modal-card h2", text: "Faire les courses"
        find(".tab", text: "Rejoindre").click
        assert_selector "input[placeholder*='abc123']"
    end

    # ── Recipe editor ─────────────────────────────────────────────────────────

    def test_editor_loads_all_tabs
        visit "/recettes-editor"
        assert_selector ".editor-list-panel"
        assert_selector ".tab", text: "Recettes"
        find(".tab", text: "Recettes du matin").click
        assert_selector ".editor-list-panel"
        find(".tab", text: "Ingrédients").click
        assert_selector ".editor-list-panel"
        assert_selector "input[placeholder='Rechercher…']"
    end

    def test_editor_select_recipe_shows_form
        visit "/recettes-editor"
        first(".editor-list-item").click
        assert_selector ".editor-card"
        assert_selector "input.input[required]"
        assert_selector ".ing-table"
    end

    def test_editor_ingredient_search_filters
        visit "/recettes-editor"
        find(".tab", text: "Ingrédients").click
        assert_selector ".editor-list-item", minimum: 1
        total = all(".editor-list-item").count
        fill_in placeholder: "Rechercher…", with: "zzznomatch"
        assert_selector ".editor-list-item", count: 0
        fill_in placeholder: "Rechercher…", with: ""
        assert_selector ".editor-list-item", count: total
    end

    def test_editor_add_rayon
        orig_rayons = File.read(File.join(PUBLIC_DIR, "rayons.json")) rescue nil
        orig_enum   = $enum_rayon.dup
        begin
            visit "/recettes-editor"
            find(".tab", text: "Ingrédients").click
            find(".editor-new-btn").click
            find("button[title='Ajouter un rayon']").click
            assert_selector ".modal-card h2", text: "Nouveau rayon"
            fill_in placeholder: "Nom du rayon", with: "BrowserTestRayon"
            find(".modal-card .btn-primary").click
            assert_selector "select option", text: "BrowserTestRayon"
        ensure
            if orig_rayons
                File.write(File.join(PUBLIC_DIR, "rayons.json"), orig_rayons)
            else
                File.delete(File.join(PUBLIC_DIR, "rayons.json")) rescue nil
            end
            $enum_rayon.replace(orig_enum)
        end
    end

    def test_editor_save_new_ingredient
        orig_ingredients = File.read(File.join(PUBLIC_DIR, "ingredients.json"))
        begin
            visit "/recettes-editor"
            find(".tab", text: "Ingrédients").click
            find(".editor-new-btn").click
            find(".editor-card input.input[required]").set("BrowserTestIng")
            find(".editor-actions .btn-primary").click
            assert_selector ".toast", text: "Enregistré"
            assert_selector ".editor-list-item .eli-name", text: "BrowserTestIng"
        ensure
            File.write(File.join(PUBLIC_DIR, "ingredients.json"), orig_ingredients)
        end
    end

    def test_editor_edit_existing_recipe
        original = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        begin
            visit "/recettes-editor"
            first(".editor-list-item").click
            assert_selector ".editor-card"
            find(".instructions-textarea").set("Instructions de test")
            find(".editor-actions .btn-primary").click
            assert_selector ".toast", text: "Enregistré"
        ensure
            File.write(File.join(PUBLIC_DIR, "recettes.json"), original) if original
        end
    end

    def test_editor_delete_recipe
        original = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        begin
            visit "/recettes-editor"
            recipe_name = first(".editor-list-item .eli-name").text
            first(".editor-list-item").click
            find(".editor-actions .btn-warn").click
            assert_selector ".modal-card h2", text: /Supprimer/
            find(".modal-card .btn-primary").click
            assert_selector ".toast", text: "Enregistré"
            assert_no_selector ".editor-list-item .eli-name", text: recipe_name
        ensure
            File.write(File.join(PUBLIC_DIR, "recettes.json"), original) if original
        end
    end

    def test_editor_add_remove_ingredient_row
        visit "/recettes-editor"
        first(".editor-list-item").click
        assert_selector ".ing-row", minimum: 1
        initial_count = all(".ing-row").count
        find(".ing-header .btn-ghost").click
        assert_selector ".ing-row", count: initial_count + 1
        all(".ing-row .x").last.click
        assert_selector ".ing-row", count: initial_count
    end

    def test_editor_edit_existing_ingredient
        original = File.read(File.join(PUBLIC_DIR, "ingredients.json"))
        begin
            visit "/recettes-editor"
            find(".tab", text: "Ingrédients").click
            first(".editor-list-item").click
            assert_selector ".editor-card input.input[required]"
            find("input[placeholder*='tranche']").set("pièce(s)")
            find(".editor-actions .btn-primary").click
            assert_selector ".toast", text: "Enregistré"
        ensure
            File.write(File.join(PUBLIC_DIR, "ingredients.json"), original) if original
        end
    end

    def test_editor_delete_ingredient
        original = File.read(File.join(PUBLIC_DIR, "ingredients.json"))
        begin
            visit "/recettes-editor"
            find(".tab", text: "Ingrédients").click
            ing_name = first(".editor-list-item .eli-name").text
            first(".editor-list-item").click
            find(".editor-actions .btn-warn").click
            assert_selector ".modal-card h2", text: /Supprimer/
            find(".modal-card .btn-primary").click
            assert_no_selector ".editor-list-item .eli-name", text: ing_name
            assert_selector ".toast", text: "Enregistré"
        ensure
            File.write(File.join(PUBLIC_DIR, "ingredients.json"), original) if original
        end
    end

    def test_editor_matin_tab_select_recipe
        visit "/recettes-editor"
        find(".tab", text: "Recettes du matin").click
        assert_selector ".editor-list-item", minimum: 1
        first(".editor-list-item").click
        assert_selector ".editor-card"
        assert_selector "input.input[required]"
    end

    # ── Shopping session ──────────────────────────────────────────────────────

    def test_shop_nickname_gate
        sid = make_session
        visit "/shop/#{sid}"
        assert_selector "#nickname-gate", visible: true
        fill_in "nickname-input", with: "Alice"
        click_button "C'est parti !"
        assert_selector "#nickname-gate", visible: false
        assert_selector "#shop-nick", text: "Alice"
    end

    def test_shop_check_and_uncheck_item
        sid = make_session
        visit "/shop/#{sid}"
        fill_in "nickname-input", with: "Alice"
        click_button "C'est parti !"

        assert_selector ".shop-item", minimum: 1
        # read data-name before interacting (shop.js re-renders innerHTML on each update)
        item_name = first(".shop-item")["data-name"]

        find(".shop-item[data-name='#{item_name}']").click
        assert_selector ".shop-item.checked[data-name='#{item_name}']"

        # re-find after re-render
        find(".shop-item[data-name='#{item_name}']").click
        assert_no_selector ".shop-item.checked[data-name='#{item_name}']"
    end

    def test_shop_edit_mode_toggle
        sid = make_session
        visit "/shop/#{sid}"
        fill_in "nickname-input", with: "Bob"
        click_button "C'est parti !"

        assert_selector "#add-item-panel", visible: false
        find("#edit-toggle").click
        assert_selector "#add-item-panel", visible: true
    end

    def test_shop_add_item_in_edit_mode
        sid = make_session
        visit "/shop/#{sid}"
        fill_in "nickname-input", with: "Alice"
        click_button "C'est parti !"
        assert_selector ".shop-item", minimum: 1
        find("#edit-toggle").click
        find("#add-name").set("Beurre")
        find("#add-qty").set("250g")
        find("#add-submit").click
        assert_selector ".shop-item[data-name='Beurre']"
    end

    def test_shop_delete_item_in_edit_mode
        sid = make_session
        visit "/shop/#{sid}"
        fill_in "nickname-input", with: "Alice"
        click_button "C'est parti !"
        assert_selector ".shop-item", minimum: 1
        item_name = first(".shop-item")["data-name"]
        find("#edit-toggle").click
        assert_selector ".delete-btn", minimum: 1
        find(".delete-btn[data-name='#{item_name}']").click
        assert_no_selector ".shop-item[data-name='#{item_name}']"
    end

    def test_shop_progress_bar_updates
        sid = make_session
        visit "/shop/#{sid}"
        fill_in "nickname-input", with: "Alice"
        click_button "C'est parti !"
        assert_selector ".shop-item", minimum: 1
        item_name = first(".shop-item")["data-name"]
        find(".shop-item[data-name='#{item_name}']").click
        assert_selector ".shop-item.checked", minimum: 1
        width = page.evaluate_script("document.getElementById('progress-bar').style.width")
        refute_equal "0%", width, "Progress bar should advance after checking an item"
    end

    def test_shop_enter_key_confirms_nickname
        sid = make_session
        visit "/shop/#{sid}"
        assert_selector "#nickname-gate", visible: true
        find("#nickname-input").send_keys("Bob", :return)
        assert_selector "#nickname-gate", visible: false
        assert_selector "#shop-nick", text: "Bob"
    end

    # ── Cook view ─────────────────────────────────────────────────────────────

    def test_cook_renders_days
        id = make_saved_list
        visit "/cook/#{id}"
        assert_selector ".day", minimum: 1
        assert_selector ".meal-name", text: "Omelette"
    end

    def test_cook_meal_modal_opens_and_closes
        id = make_saved_list
        visit "/cook/#{id}"
        find(".cook-meal.clickable", text: "Omelette").click
        assert_selector ".modal-card h2", text: "Omelette"
        find(".x[aria-label='Fermer']").click
        assert_no_selector ".modal-card h2", text: "Omelette"
    end

    def test_cook_modal_shows_ingredients
        id = make_saved_list
        visit "/cook/#{id}"
        find(".cook-meal.clickable", text: "Omelette").click
        assert_selector ".modal-card h2", text: "Omelette"
        assert_selector ".cook-ing-name", minimum: 1
    end

    def test_cook_modal_shows_instructions
        original = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        begin
            recettes       = JSON.parse(original)
            recipe         = recettes["recettes"].first
            recipe["instructions"] = "- Étape 1\n- Étape 2"
            File.write(File.join(PUBLIC_DIR, "recettes.json"), JSON.generate(recettes))

            liste = {
                "jours" => [
                    {"matin"    => {"recette" => "",              "gens" => 10},
                     "dejeuner" => {"recette" => recipe["name"],  "gens" => 10},
                     "diner"    => {"recette" => "",              "gens" => 10}}
                ],
                "extras" => [], "extras_txt" => ""
            }
            DB.execute("INSERT INTO saved_lists (name, created_at, data) VALUES (?, ?, ?)",
                       ["Test instructions", Time.now.utc.iso8601, liste.to_json])
            id = DB.execute("SELECT id FROM saved_lists ORDER BY id DESC LIMIT 1").first["id"]

            visit "/cook/#{id}"
            find(".cook-meal.clickable", text: recipe["name"]).click
            assert_selector ".cook-instructions li", minimum: 1
        ensure
            File.write(File.join(PUBLIC_DIR, "recettes.json"), original) if original
        end
    end

    def test_cook_matin_slot_displayed
        liste = {
            "jours" => [
                {"matin"    => {"recette" => "Matin Ski", "gens" => 8},
                 "dejeuner" => {"recette" => "",          "gens" => 10},
                 "diner"    => {"recette" => "",          "gens" => 10}}
            ],
            "extras" => [], "extras_txt" => ""
        }
        DB.execute("INSERT INTO saved_lists (name, created_at, data) VALUES (?, ?, ?)",
                   ["Test matin", Time.now.utc.iso8601, liste.to_json])
        id = DB.execute("SELECT id FROM saved_lists ORDER BY id DESC LIMIT 1").first["id"]

        visit "/cook/#{id}"
        assert_selector ".meal-name", text: "Matin Ski"
        find(".cook-meal.clickable", text: "Matin Ski").click
        assert_selector ".modal-card h2", text: "Matin Ski"
    end

    # ── Full end-to-end ───────────────────────────────────────────────────────

    def test_full_e2e_workflow
        orig_ingredients = File.read(File.join(PUBLIC_DIR, "ingredients.json"))
        orig_recettes    = File.read(File.join(PUBLIC_DIR, "recettes.json"))
        orig_rayons_raw  = File.read(File.join(PUBLIC_DIR, "rayons.json")) rescue nil
        orig_enum_rayon  = $enum_rayon.dup

        begin
            # ── 1. Add a rayon ────────────────────────────────────────────────
            visit "/recettes-editor"
            find(".tab", text: "Ingrédients").click
            find(".editor-new-btn").click
            find("button[title='Ajouter un rayon']").click
            assert_selector ".modal-card h2", text: "Nouveau rayon"
            # x-model="promptDialog && promptDialog.value" is read-only from Selenium's
            # perspective — set the Alpine reactive value directly instead
            page.execute_script(
                "document.querySelector('[x-data]')._x_dataStack[0].promptDialog.value = 'TestRayon E2E'"
            )
            find(".modal-card .btn-primary").click
            # poll until the browser's async /rayons/save lands on the server
            # (test shares the same Ruby process, so $enum_rayon is directly accessible)
            deadline = Time.now + 5
            until $enum_rayon.include?("TestRayon E2E")
                raise "TestRayon E2E was not saved within 5s" if Time.now > deadline
                sleep 0.05
            end

            # ── 2. Create ingredient in that rayon ────────────────────────────
            # compound x-model ("selectedIng && selectedIng.name") is opaque to Selenium;
            # set via Alpine reactive data directly
            page.execute_script(
                "document.querySelector('[x-data]')._x_dataStack[0].selectedIng.name = 'TestIngredient E2E'"
            )
            # rayon already auto-set to TestRayon E2E by addRayon()
            find(".editor-actions .btn-primary").click
            assert_selector ".toast", text: "Enregistré"
            assert_selector ".editor-list-item .eli-name", text: "TestIngredient E2E"

            # ── 3. Create recipe using the new ingredient ─────────────────────
            find(".tab", exact_text: "Recettes").click
            find(".editor-new-btn").click
            page.execute_script(
                "document.querySelector('[x-data]')._x_dataStack[0].selected.name = 'TestRecette E2E'"
            )
            within(".ing-table") do
                find("input[placeholder='Ingrédient']").set("TestIngredient E2E")
                find("input[placeholder='—']").set("100")
            end
            find(".editor-actions .btn-primary").click
            assert_selector ".toast", text: "Enregistré"
            assert_selector ".editor-list-item .eli-name", text: "TestRecette E2E"

            # ── 4. Plan: select recipe, verify sidebar ────────────────────────
            visit "/"
            assert_selector "select.meal-select option", text: "TestRecette E2E"
            first("select.meal-select").find("option", text: "TestRecette E2E").select_option
            assert_selector ".li-name", text: "TestIngredient E2E"

            # ── 5. Save the list ──────────────────────────────────────────────
            find(".topbar-actions .btn-ghost", text: /Sauver/).click
            assert_selector ".modal-card h2", text: "Sauvegarder"
            fill_in placeholder: "ex: Kinzout 2026", with: "Test E2E"
            find(".modal-card .btn-primary").click
            assert_selector ".toast", text: "sauvegardée"

            # ── 6. Load the saved list ────────────────────────────────────────
            find(".topbar-actions .btn-ghost", text: /Charger/).click
            assert_selector ".modal-card h2", text: "Charger"
            find(".saved-item", text: /Test E2E/).click
            find(".modal-card .btn-primary", text: "Charger").click
            assert_selector ".li-name", text: "TestIngredient E2E"

            # ── 7. Shopping session: check an item ────────────────────────────
            find(".btn-accent").click
            assert_selector ".modal-card h2", text: "Faire les courses"
            find(".modal-card .btn-primary", text: "Nouvelle session").click

            assert_selector "#nickname-gate", visible: true
            fill_in "nickname-input", with: "Alice"
            click_button "C'est parti !"
            assert_selector "#shop-nick", text: "Alice"
            assert_selector ".shop-item", minimum: 1
            item_name = first(".shop-item")["data-name"]
            find(".shop-item[data-name='#{item_name}']").click
            assert_selector ".shop-item.checked[data-name='#{item_name}']"

            # ── 8. Cook view for the saved list ───────────────────────────────
            visit "/"
            assert_selector "select.meal-select option:not([value=''])", minimum: 1
            find(".topbar-actions .btn-ghost", text: /Cuisiner/).click
            # openCook() is async; find() on the saved-item serves as the wait
            find(".saved-item", text: /Test E2E/).click
            find(".modal-card .btn-primary", text: "Ouvrir").click
            assert_selector ".day", minimum: 1
            assert_selector ".meal-name", text: "TestRecette E2E"
        ensure
            File.write(File.join(PUBLIC_DIR, "ingredients.json"), orig_ingredients)
            File.write(File.join(PUBLIC_DIR, "recettes.json"), orig_recettes)
            if orig_rayons_raw
                File.write(File.join(PUBLIC_DIR, "rayons.json"), orig_rayons_raw)
            else
                File.delete(File.join(PUBLIC_DIR, "rayons.json")) rescue nil
            end
            $enum_rayon.replace(orig_enum_rayon)
        end
    end
end
