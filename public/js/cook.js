// Cook view — Alpine.js controller.
// Renders a saved list as a day-by-day grid; clicking a meal shows the
// recipe (scaled ingredients + Markdown instructions) in a modal.
// Backend routes used: /recettes.json, /matin.json, /ingredients, /rayons.

(function () {
    "use strict";

    const SLOT_LABELS = {matin: "Matin", dejeuner: "Déjeuner", diner: "Soir"};
    const SLOT_TAGS   = {matin: "M",     dejeuner: "D",        diner: "S"};

    function cookApp() {
        return {
            recettes: [],
            recettes_matin: [],
            liste_ingredients: {},
            ready: false,

            list_name: "",
            days: [],

            dialog: null,           // 'meal' | null
            current_meal: null,

            async init() {
                const body = document.body;
                this.list_name = body.dataset.listName || "Liste";
                let saved = {};
                try { saved = JSON.parse(body.dataset.savedList || "{}"); }
                catch (e) { saved = {}; }

                try {
                    const [a, b, c] = await Promise.all([
                        fetch("/recettes.json", {cache: "no-cache"}).then(r => r.json()),
                        fetch("/matin.json",    {cache: "no-cache"}).then(r => r.json()),
                        fetch("/ingredients",   {cache: "no-cache"}).then(r => r.json()),
                    ]);
                    this.recettes = a.recettes || [];
                    this.recettes_matin = b.recettes || [];
                    this.liste_ingredients = c;
                } catch (e) {
                    // best-effort: still render what we can
                }

                this.days = (saved.jours || []).map(j => ({
                    matin:    {recette: j.matin    && j.matin.recette    || "", gens: j.matin    && j.matin.gens    || 0},
                    dejeuner: {recette: j.dejeuner && j.dejeuner.recette || "", gens: j.dejeuner && j.dejeuner.gens || 0},
                    diner:    {recette: j.diner    && j.diner.recette    || "", gens: j.diner    && j.diner.gens    || 0},
                }));
                this.ready = true;
            },

            slotLabel(slot) { return SLOT_LABELS[slot] || slot; },
            slotTag(slot)   { return SLOT_TAGS[slot]   || "?"; },

            _findRecette(name, slot) {
                const src = slot === "matin" ? this.recettes_matin : this.recettes;
                for (const r of src) { if (r.name === name) { return r; } }
                return null;
            },

            _scaledIngredients(recette, gens) {
                if (!recette || !recette.ingredients) { return []; }
                const flat = [];
                for (const ing of recette.ingredients) {
                    const copy = {name: ing.name};
                    const meta = this.liste_ingredients[ing.name] || {};
                    if (typeof meta.unit !== "undefined" && meta.unit !== "") {
                        copy.unit = meta.unit;
                    }
                    if (typeof ing.qty !== "undefined" && ing.qty !== null) {
                        copy.qty = ing.qty;
                    }
                    ListeHelpers.addToListe(flat, copy, gens || 0);
                }
                return flat.map(i => ({
                    name:    i.name,
                    display: ListeHelpers.arrondi(i.qty, i.unit),
                }));
            },

            openMeal(jourIdx, slot) {
                const cell = this.days[jourIdx] && this.days[jourIdx][slot];
                if (!cell || !cell.recette) { return; }
                const r = this._findRecette(cell.recette, slot);
                this.current_meal = {
                    name:         cell.recette,
                    slot_label:   this.slotLabel(slot),
                    gens:         cell.gens,
                    ingredients:  this._scaledIngredients(r, cell.gens),
                    instructions: (r && r.instructions) || "",
                };
                this.dialog = "meal";
            },

            closeDialog() {
                this.dialog = null;
                this.current_meal = null;
            },

            renderMarkdown(text) {
                if (!text) { return ""; }
                try { return window.marked.parse(text); }
                catch (e) { return text; }
            },
        };
    }

    window.cookApp = cookApp;
})();
