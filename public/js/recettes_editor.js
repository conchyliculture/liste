(function () {
    "use strict";

    function editorApp() {
        return {
            // ── State ─────────────────────────────────────────────────────────
            tabIndex: 0,
            recettes: [],
            recettes_matin: [],
            catalog: {},
            catalogList: [],
            rayons: [],
            ingredientNames: [],
            selected: null,
            selectedIng: null,
            ingSearch: "",
            confirmDialog: null,
            promptDialog: null,
            toast: "",

            // ── Init ──────────────────────────────────────────────────────────
            async init() {
                try {
                    const [a, b, c, d, e] = await Promise.all([
                        fetch("/recettes.json").then(r => r.json()),
                        fetch("/matin.json").then(r => r.json()),
                        fetch("/ingredients").then(r => r.json()),
                        fetch("/rayons").then(r => r.json()),
                        fetch("/ingredients/raw").then(r => r.json()),
                    ]);
                    this.recettes        = a.recettes || [];
                    this.recettes_matin  = b.recettes || [];
                    this.ingredientNames = Object.keys(c).sort();
                    this.rayons          = d;
                    this.catalog         = e;
                    this._buildCatalogList();
                } catch (err) {
                    this._toast("Erreur de chargement: " + err.message);
                }
            },

            // ── Computed ──────────────────────────────────────────────────────
            get currentList() {
                const list = this.tabIndex === 0 ? this.recettes : this.recettes_matin;
                return list.slice().sort((a, b) => a.name.localeCompare(b.name, "fr", {sensitivity: "base"}));
            },

            get filteredCatalog() {
                const q = (this.ingSearch || "").toLowerCase();
                return q ? this.catalogList.filter(i => i.name.toLowerCase().includes(q))
                         : this.catalogList;
            },

            // ── Tabs ──────────────────────────────────────────────────────────
            switchTab(idx) {
                this.tabIndex   = idx;
                this.selected    = null;
                this.selectedIng = null;
                if (idx < 2) {
                    fetch("/recettes.json").then(r => r.json()).then(d => { this.recettes = d.recettes || []; });
                    fetch("/matin.json").then(r => r.json()).then(d => { this.recettes_matin = d.recettes || []; });
                }
            },

            // ── Recipe editor ─────────────────────────────────────────────────
            selectRecette(r) {
                const clone = JSON.parse(JSON.stringify(r));
                clone._isNew = false;
                clone._originalName = r.name;
                clone.instructions = r.instructions || "";
                clone.ingredients.forEach(ing => { if (ing.qty == null) ing.qty = ""; });
                this.selected = clone;
            },

            newRecette() {
                this.selected = {
                    name: "", ingredients: [{name: "", qty: ""}],
                    instructions: "", _isNew: true, _originalName: null
                };
            },

            cancelEdit() { this.selected = null; },

            addIngredient() {
                this.selected.ingredients.push({name: "", qty: ""});
            },

            removeIngredient(idx) {
                this.selected.ingredients.splice(idx, 1);
            },

            deleteRecette() {
                const originalName = this.selected._originalName;
                this._showConfirm({
                    title: "Supprimer la recette ?",
                    body: '"' + originalName + '"',
                    ok: "Supprimer",
                    onOk: () => {
                        const list = this._mutableList();
                        const idx  = this._findIdx(list, originalName);
                        if (idx >= 0) list.splice(idx, 1);
                        this.selected = null;
                        this._postList(list, () => {});
                    }
                });
            },

            async save() {
                const name = (this.selected.name || "").trim();
                if (!name) { this._toast("Le nom est requis."); return; }

                const ings = this.selected.ingredients
                    .filter(i => (i.name || "").trim() !== "")
                    .map(i => {
                        const out = {name: i.name.trim()};
                        const q = parseFloat(i.qty);
                        if (!isNaN(q) && i.qty !== "" && i.qty != null) out.qty = q;
                        return out;
                    });
                if (!ings.length) { this._toast("Ajoutez au moins un ingrédient."); return; }

                const list = this._mutableList();
                if (name !== this.selected._originalName && this._findIdx(list, name) >= 0) {
                    this._toast("Une recette avec ce nom existe déjà.");
                    return;
                }

                const instructions = (this.selected.instructions || "").trim();
                const recipe = {name, ingredients: ings};
                if (instructions) recipe.instructions = instructions;

                const idx = this._findIdx(list, this.selected._originalName);
                if (this.selected._isNew || idx < 0) {
                    list.push(recipe);
                } else {
                    list[idx] = recipe;
                }

                this._postList(list, () => {
                    this.selected._isNew = false;
                    this.selected._originalName = name;
                    this.selected.name = name;
                    this.selected.instructions = instructions;
                    this.selected.ingredients = ings.map(i => ({name: i.name, qty: i.qty !== undefined ? i.qty : ""}));
                });
            },

            // ── Ingredient catalog ────────────────────────────────────────────
            selectIng(ing) {
                this.selectedIng = {
                    name: ing.name, rayon: ing.rayon, unit: ing.unit,
                    _originalName: ing.name, _isNew: false
                };
            },

            newIng() {
                this.selectedIng = {
                    name: "", rayon: this.rayons[0] || "", unit: "",
                    _originalName: null, _isNew: true
                };
            },

            cancelIngEdit() { this.selectedIng = null; },

            addRayon() {
                this._showPrompt({
                    title: "Nouveau rayon",
                    placeholder: "Nom du rayon",
                    ok: "Ajouter",
                    onOk: (name) => {
                        name = (name || "").trim();
                        if (!name) return;
                        if (this.rayons.indexOf(name) >= 0) { this._toast("Ce rayon existe déjà."); return; }
                        this.rayons.push(name);
                        if (this.selectedIng) this.selectedIng.rayon = name;
                        fetch("/rayons/save", {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify(this.rayons)
                        }).then(r => {
                            if (!r.ok) { this._toast("Erreur: " + r.statusText); this.rayons.pop(); }
                        });
                    }
                });
            },

            deleteIng() {
                const originalName = this.selectedIng._originalName;
                this._showConfirm({
                    title: "Supprimer l'ingrédient ?",
                    body: '"' + originalName + '"',
                    ok: "Supprimer",
                    onOk: () => {
                        delete this.catalog[originalName];
                        this.selectedIng = null;
                        this._buildCatalogList();
                        this._postCatalog(() => {});
                    }
                });
            },

            saveIng() {
                const oldName = this.selectedIng._originalName;
                const name    = (this.selectedIng.name || "").trim();
                if (!name) { this._toast("Le nom est requis."); return; }
                if (!this.selectedIng.rayon) { this._toast("Le rayon est requis."); return; }
                if (name !== oldName && this.catalog[name]) {
                    this._toast("Un ingrédient avec ce nom existe déjà.");
                    return;
                }
                if (oldName && name !== oldName) delete this.catalog[oldName];
                const entry = {rayon: this.selectedIng.rayon};
                const unit  = (this.selectedIng.unit || "").trim();
                if (unit) entry.unit = unit;
                this.catalog[name] = entry;
                this._buildCatalogList();
                this._postCatalog(() => {
                    if (oldName && name !== oldName) this._renameInRecipes(oldName, name);
                    this.selectedIng._originalName = name;
                    this.selectedIng._isNew = false;
                    this.selectedIng.name = name;
                });
            },

            // ── Private helpers ───────────────────────────────────────────────
            _buildCatalogList() {
                this.catalogList = Object.keys(this.catalog)
                    .sort((a, b) => a.localeCompare(b, "fr", {sensitivity: "base"}))
                    .map(n => ({name: n, rayon: this.catalog[n].rayon || "", unit: this.catalog[n].unit || ""}));
            },

            _mutableList() {
                return this.tabIndex === 0 ? this.recettes : this.recettes_matin;
            },

            _findIdx(list, name) {
                for (let i = 0; i < list.length; i++) { if (list[i].name === name) return i; }
                return -1;
            },

            async _postList(list, onSuccess) {
                const url = this.tabIndex === 0 ? "/recettes/save" : "/matin/save";
                try {
                    const r = await fetch(url, {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({recettes: list}),
                    });
                    if (!r.ok) throw new Error(await r.text());
                    this._toast("Enregistré !");
                    onSuccess();
                } catch (err) {
                    this._toast("Erreur: " + err.message);
                    const reload = this.tabIndex === 0 ? "/recettes.json" : "/matin.json";
                    const key    = this.tabIndex === 0 ? "recettes" : "recettes_matin";
                    fetch(reload).then(r => r.json()).then(d => { this[key] = d.recettes || []; });
                }
            },

            async _postCatalog(onSuccess) {
                try {
                    const r = await fetch("/ingredients/save", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify(this.catalog),
                    });
                    if (!r.ok) throw new Error(await r.text());
                    this._toast("Enregistré !");
                    this.ingredientNames = Object.keys(this.catalog)
                        .sort((a, b) => a.localeCompare(b, "fr", {sensitivity: "base"}));
                    onSuccess();
                } catch (err) {
                    this._toast("Erreur: " + err.message);
                    fetch("/ingredients/raw").then(r => r.json()).then(d => {
                        this.catalog = d;
                        this._buildCatalogList();
                    });
                }
            },

            _renameInRecipes(oldName, newName) {
                const dirty = [false, false];
                [this.recettes, this.recettes_matin].forEach((list, i) => {
                    list.forEach(r => {
                        r.ingredients.forEach(ing => {
                            if (ing.name === oldName) { ing.name = newName; dirty[i] = true; }
                        });
                    });
                });
                const post = (url, list) => fetch(url, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({recettes: list}),
                });
                if (dirty[0]) post("/recettes/save", this.recettes);
                if (dirty[1]) post("/matin/save", this.recettes_matin);
            },

            _showConfirm({title, body, ok, cancel, onOk}) {
                this.confirmDialog = {
                    title, body: body || "",
                    okLabel: ok || "OK",
                    cancelLabel: cancel || "Annuler",
                    onOk
                };
            },

            confirmOk() {
                const d = this.confirmDialog;
                this.confirmDialog = null;
                d && d.onOk && d.onOk();
            },

            confirmCancel() { this.confirmDialog = null; },

            _showPrompt({title, placeholder, ok, cancel, onOk}) {
                this.promptDialog = {
                    title, placeholder: placeholder || "",
                    value: "",
                    okLabel: ok || "OK",
                    cancelLabel: cancel || "Annuler",
                    onOk
                };
            },

            promptOk() {
                const d = this.promptDialog;
                this.promptDialog = null;
                d && d.onOk && d.onOk(d.value);
            },

            promptCancel() { this.promptDialog = null; },

            _toast(msg) {
                this.toast = msg;
                clearTimeout(this._toastT);
                this._toastT = setTimeout(() => { this.toast = ""; }, 2500);
            },
        };
    }

    window.editorApp = editorApp;
})();
