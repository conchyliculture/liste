// Main planner view — Alpine.js controller.
// Builds the consolidated shopping list from selected recipes, extras and custom items.
// Backend routes used: /recettes.json, /matin.json, /ingredients, /rayons,
// /save, /get-stored-listes, /shopping-session.

(function () {
    "use strict";

    const NB_GENS_DEFAULT = 10;
    const NB_JOURS_DEFAULT = 5;

    function sortByName(a, b) {
        return a.name.localeCompare(b.name, "fr", {sensitivity: "base"});
    }

    function blankItem() {
        return {name: "", qty: "", unit: "", rayon: null};
    }

    function listeApp() {
        return {
            // ── Loaded data ───────────────────────────────────────────────────
            recettes: [],
            recettes_matin: [],
            liste_ingredients: {},
            enum_rayon: [],
            errors_msg: "",
            ready: false,

            // ── Planner state ─────────────────────────────────────────────────
            nb_jours: NB_JOURS_DEFAULT,
            recette_matin: "",
            gens_par_matin: new Array(NB_JOURS_DEFAULT).fill(NB_GENS_DEFAULT),
            gens_par_dejeuner: new Array(NB_JOURS_DEFAULT).fill(NB_GENS_DEFAULT),
            gens_par_diner: new Array(NB_JOURS_DEFAULT).fill(NB_GENS_DEFAULT),
            recette_dejeuner_par_jour: new Array(NB_JOURS_DEFAULT).fill(""),
            recette_diner_par_jour: new Array(NB_JOURS_DEFAULT).fill(""),

            extras: [
                {name: "Capitain Morgan Spiced Rum", enabled: false, key: "rum",  unit: " bouteilles (75cl)"},
                {name: "Crème de marron (Clément Faugier)", enabled: false, key: "marron", unit: " Pots (500g)"},
                {name: "Fruits divers", enabled: false, key: "fruits", unit: " kg (0.5*nb jours)"},
                {name: "Gateau apéro", enabled: false, key: "apero",  unit: " Paquets divers (chips, bretzels, etc)"},
                {name: "Pastille lave-vaisselle", enabled: false, key: "pastille", unit: " tablettes"},
                {name: "Produit vaisselle", enabled: false, key: "vaisselle", unit: " bidon"},
                {name: "PQ", enabled: false, key: "pq", unit: " rouleaux"},
                {name: "Sacs poubelle", enabled: false, key: "sacs", unit: " rouleaux de 10"},
                {name: "Pain", enabled: false, key: "pain", unit: " "},
                {name: "Saucisson", enabled: false, key: "saucisson", unit: " saucissons"},
                {name: "Torchons", enabled: false, key: "torchons", unit: " "},
                {name: "Yaourts", enabled: false, key: "yaourts", unit: " pots de yaourts"},
            ],

            extras_txt: "",
            custom_items: [],
            new_item: blankItem(),

            liste_rayons: [],

            // ── UI state ──────────────────────────────────────────────────────
            view: "planner",                   // mobile: 'planner' | 'list'
            dialog: null,                      // 'save' | 'load' | 'shop' | 'cook' | null
            save_name: "",
            load_listes: [],
            load_selected: null,
            cook_selected: null,
            shop_mode: "create",               // 'create' | 'join'
            shop_join_id: "",
            toast: "",

            // ── Init ──────────────────────────────────────────────────────────
            async init() {
                try {
                    await this._fetchData();
                    this.ready = true;
                    const draft = localStorage.getItem("liste_draft");
                    if (draft) {
                        try { this._applyStoredListe(JSON.parse(draft)); }
                        catch (_) { this.updateListe(); }
                    } else {
                        this.updateListe();
                    }
                } catch (e) {
                    this.errors_msg = "Erreur de chargement: " + e.message;
                }
                // bfcache: page restored from memory after back-navigation — re-fetch
                // recipe data so edits made in the editor tab are reflected immediately.
                window.addEventListener("pageshow", async (ev) => {
                    if (!ev.persisted) { return; }
                    try { await this._fetchData(); this.updateListe(); } catch (_) {}
                });
            },

            async _fetchData() {
                const [a, b, c, d] = await Promise.all([
                    fetch("/recettes.json", {cache: "no-cache"}).then(r => r.json()),
                    fetch("/matin.json",    {cache: "no-cache"}).then(r => r.json()),
                    fetch("/ingredients",   {cache: "no-cache"}).then(r => r.json()),
                    fetch("/rayons",        {cache: "no-cache"}).then(r => r.json()),
                ]);
                this.recettes        = (a.recettes || []).slice().sort(sortByName);
                this.recettes_matin  = (b.recettes || []).slice().sort(sortByName);
                this.liste_ingredients = c;
                this.enum_rayon      = d;
            },

            // ── Derived ───────────────────────────────────────────────────────
            get totalGens() {
                let total = 0;
                for (let j = 0; j < this.nb_jours; j++) {
                    total += ((this.gens_par_matin[j] || 0)
                            + (this.gens_par_dejeuner[j] || 0)
                            + (this.gens_par_diner[j] || 0)) / 3;
                }
                return Math.ceil(total / this.nb_jours);
            },

            get totalItems() {
                let n = 0;
                for (const r of this.liste_rayons) { n += r.items.length; }
                return n;
            },

            // ── Helpers (private) ─────────────────────────────────────────────
            _getRayon(name)     { return this.liste_ingredients[name]?.rayon; },
            _getUnit(name)      { return this.liste_ingredients[name]?.unit; },

            _getIngredients(recette_name, source) {
                const out = [];
                for (const r of source) {
                    if (r.name !== recette_name) { continue; }
                    for (const ing of r.ingredients) {
                        const copy = Object.assign({}, ing);
                        copy.rayon = this._getRayon(ing.name);
                        const u = this._getUnit(ing.name);
                        if (typeof u !== "undefined" && u !== "") { copy.unit = u; }
                        out.push(copy);
                    }
                }
                return out;
            },

            _extraQty(e) {
                const n = this.nb_jours;
                switch (e.key) {
                    case "rum":       return Math.ceil(n / 2);
                    case "marron":    return Math.ceil(n / 3);
                    case "fruits":    return n / 2;
                    case "apero":     return n * 3;
                    case "pastille":  return n * 2;
                    case "vaisselle": return Math.ceil(n / 5);
                    case "pq":        return Math.ceil(this.totalGens * n / 24) * 6;
                    case "sacs":      return Math.ceil(n * 0.3);
                    case "pain":      return this.totalGens;
                    case "saucisson": return n * 3;
                    case "torchons":  return 2;
                    case "yaourts":   return Math.ceil(this.totalGens * n / 6) * 6;
                }
                return 0;
            },

            _rebuildListe() {
                // Carry over qty adjustments and in-progress edits from previous render.
                const prevAdj = {};
                const prevEdit = {};
                for (const r of this.liste_rayons) {
                    for (const it of r.items) {
                        if (it.adj !== 0) { prevAdj[it.name] = it.adj; }
                        if (it.editing)   { prevEdit[it.name] = it.editVal; }
                    }
                }

                const flat = [];
                for (let i = 0; i < this.nb_jours; i++) {
                    if (this.recette_matin) {
                        for (const ing of this._getIngredients(this.recette_matin, this.recettes_matin)) {
                            ListeHelpers.addToListe(flat, ing, this.gens_par_matin[i] || 0);
                        }
                    }
                    const d = this.recette_dejeuner_par_jour[i];
                    if (d) {
                        for (const ing of this._getIngredients(d, this.recettes)) {
                            ListeHelpers.addToListe(flat, ing, this.gens_par_dejeuner[i] || 0);
                        }
                    }
                    const s = this.recette_diner_par_jour[i];
                    if (s) {
                        for (const ing of this._getIngredients(s, this.recettes)) {
                            ListeHelpers.addToListe(flat, ing, this.gens_par_diner[i] || 0);
                        }
                    }
                }

                for (const e of this.extras) {
                    if (!e.enabled) { continue; }
                    ListeHelpers.addToListe(flat, {name: e.name, qty: this._extraQty(e), unit: e.unit}, 1);
                }
                for (const ci of this.custom_items) {
                    ListeHelpers.addToListe(flat, ci, 1);
                }

                flat.sort((a, b) => {
                    const ai = a.rayon !== null && typeof a.rayon !== "undefined" ? a.rayon : 999;
                    const bi = b.rayon !== null && typeof b.rayon !== "undefined" ? b.rayon : 999;
                    return ai - bi;
                });

                const rayons = [];
                let currentRayon = -1;
                for (const it of flat) {
                    if (it.rayon !== currentRayon) {
                        currentRayon = it.rayon;
                        rayons.push({name: this.enum_rayon[currentRayon] || "", items: []});
                    }
                    let adj = prevAdj[it.name] || 0;
                    if (typeof it.qty !== "undefined" && it.qty + adj < 0) { adj = -it.qty; }
                    const obj = {name: it.name, base_qty: it.qty, adj, unit: it.unit};
                    if (Object.prototype.hasOwnProperty.call(prevEdit, it.name)) {
                        obj.editing = true;
                        obj.editVal = prevEdit[it.name];
                    } else {
                        obj.editing = false;
                        obj.editVal = 0;
                    }
                    rayons[rayons.length - 1].items.push(obj);
                }
                this.liste_rayons = rayons;
                this._saveToLocalStorage();
            },

            _saveToLocalStorage() {
                try { localStorage.setItem("liste_draft", JSON.stringify(this._serialize())); } catch (_) {}
            },

            // ── Public actions ────────────────────────────────────────────────
            updateListe() { if (this.ready) { this._rebuildListe(); } },

            resetListe() {
                if (!confirm("Réinitialiser la liste ?")) { return; }
                localStorage.removeItem("liste_draft");
                this.nb_jours = NB_JOURS_DEFAULT;
                this.recette_matin = "";
                this.gens_par_matin            = new Array(NB_JOURS_DEFAULT).fill(NB_GENS_DEFAULT);
                this.gens_par_dejeuner         = new Array(NB_JOURS_DEFAULT).fill(NB_GENS_DEFAULT);
                this.gens_par_diner            = new Array(NB_JOURS_DEFAULT).fill(NB_GENS_DEFAULT);
                this.recette_dejeuner_par_jour = new Array(NB_JOURS_DEFAULT).fill("");
                this.recette_diner_par_jour    = new Array(NB_JOURS_DEFAULT).fill("");
                for (const e of this.extras) { e.enabled = false; }
                this.extras_txt = "";
                this.custom_items = [];
                this.updateListe();
            },

            onJoursChanged() {
                const n = Math.max(1, Math.min(20, parseInt(this.nb_jours) || 1));
                this.nb_jours = n;
                const ensure = (arr, def) => {
                    while (arr.length < n) { arr.push(def); }
                    arr.length = n;
                };
                ensure(this.gens_par_matin,            NB_GENS_DEFAULT);
                ensure(this.gens_par_dejeuner,         NB_GENS_DEFAULT);
                ensure(this.gens_par_diner,            NB_GENS_DEFAULT);
                ensure(this.recette_dejeuner_par_jour, "");
                ensure(this.recette_diner_par_jour,    "");
                this.updateListe();
            },

            hasQty(item) {
                return typeof item.base_qty !== "undefined" && item.base_qty !== null;
            },

            displayQty(item) {
                if (!this.hasQty(item)) { return ""; }
                return ListeHelpers.arrondi(item.base_qty + item.adj, item.unit);
            },

            stepForUnit(unit) { return {g: 100, cL: 25, L: 1}[unit] || 1; },

            adjustQty(item, dir) {
                if (!this.hasQty(item)) { return; }
                const step = this.stepForUnit(item.unit);
                item.adj += dir * step;
                if (item.base_qty + item.adj < 0) { item.adj = -item.base_qty; }
            },

            startEditQty(item) {
                if (!this.hasQty(item)) { return; }
                item.editVal = item.base_qty + item.adj;
                item.editing = true;
            },

            commitEditQty(item) {
                const v = Number(item.editVal);
                if (!isNaN(v) && v >= 0) { item.adj = v - item.base_qty; }
                item.editing = false;
            },

            cancelEditQty(item) { item.editing = false; },

            addCustomItem() {
                const name = this.new_item.name.trim();
                if (!name) { return; }
                const qty = this.new_item.qty !== "" && this.new_item.qty !== null
                    ? Number(this.new_item.qty)
                    : undefined;
                const item = {name, unit: this.new_item.unit || "", rayon: this.new_item.rayon};
                if (typeof qty !== "undefined" && !isNaN(qty)) { item.qty = qty; }
                this.custom_items.push(item);
                this.new_item = blankItem();
                this.updateListe();
            },

            removeCustomItem(idx) {
                this.custom_items.splice(idx, 1);
                this.updateListe();
            },

            // ── Save / Load ───────────────────────────────────────────────────
            _serialize() {
                const result = {jours: [], extras: [], extras_txt: this.extras_txt};
                for (let i = 0; i < this.nb_jours; i++) {
                    result.jours.push({
                        matin:    {recette: this.recette_matin,                  gens: this.gens_par_matin[i]},
                        dejeuner: {recette: this.recette_dejeuner_par_jour[i],   gens: this.gens_par_dejeuner[i]},
                        diner:    {recette: this.recette_diner_par_jour[i],      gens: this.gens_par_diner[i]},
                    });
                }
                for (const e of this.extras) {
                    result.extras.push({name: e.name, enabled: e.enabled});
                }
                result.custom_items = this.custom_items;
                const adjs = {};
                for (const r of this.liste_rayons) {
                    for (const it of r.items) {
                        if (it.adj !== 0) { adjs[it.name] = it.adj; }
                    }
                }
                result.qty_adjustments = adjs;
                return result;
            },

            openSave()  { this.save_name = ""; this.dialog = "save"; },
            openShop()  { this.shop_mode = "create"; this.shop_join_id = ""; this.dialog = "shop"; },
            closeDialog() { this.dialog = null; },

            async _fetchStoredListes() {
                const r = await fetch("/get-stored-listes");
                const list = await r.json();
                list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
                this.load_listes = list;
                return list;
            },

            async openLoad() {
                try {
                    const list = await this._fetchStoredListes();
                    this.load_selected = list[0] || null;
                    this.dialog = "load";
                } catch (e) {
                    this._toast("Impossible de charger les listes");
                }
            },

            async openCook() {
                try {
                    const list = await this._fetchStoredListes();
                    this.cook_selected = list[0] || null;
                    this.dialog = "cook";
                } catch (e) {
                    this._toast("Impossible de charger les listes");
                }
            },

            confirmCook() {
                if (!this.cook_selected) { return; }
                window.location = "/cook/" + this.cook_selected.id;
                this.dialog = null;
            },

            async confirmSave() {
                const name = (this.save_name || "").trim();
                if (!/^[a-z0-9 ]+$/i.test(name)) {
                    this._toast("Nom invalide (lettres, chiffres, espaces uniquement)");
                    return;
                }
                try {
                    const r = await fetch("/save", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({name, liste: this._serialize()}),
                    });
                    if (!r.ok) { throw new Error(await r.text()); }
                    this._toast("Liste sauvegardée");
                    this.dialog = null;
                } catch (e) {
                    this._toast("Erreur: " + e.message);
                }
            },

            loadFromSelection() {
                if (!this.load_selected) { return; }
                this._applyStoredListe(this.load_selected.liste);
                this.dialog = null;
                this._toast("Liste chargée");
            },

            _applyStoredListe(liste) {
                const jours = liste.jours || [];
                this.nb_jours = jours.length || NB_JOURS_DEFAULT;
                this.gens_par_matin            = new Array(this.nb_jours).fill(NB_GENS_DEFAULT);
                this.gens_par_dejeuner         = new Array(this.nb_jours).fill(NB_GENS_DEFAULT);
                this.gens_par_diner            = new Array(this.nb_jours).fill(NB_GENS_DEFAULT);
                this.recette_dejeuner_par_jour = new Array(this.nb_jours).fill("");
                this.recette_diner_par_jour    = new Array(this.nb_jours).fill("");
                this.recette_matin = jours[0]?.matin?.recette ?? "";
                for (let i = 0; i < jours.length; i++) {
                    const j = jours[i];
                    this.gens_par_matin[i]            = j.matin?.gens     ?? NB_GENS_DEFAULT;
                    this.recette_dejeuner_par_jour[i] = j.dejeuner?.recette ?? "";
                    this.gens_par_dejeuner[i]         = j.dejeuner?.gens    ?? NB_GENS_DEFAULT;
                    this.recette_diner_par_jour[i]    = j.diner?.recette    ?? "";
                    this.gens_par_diner[i]            = j.diner?.gens       ?? NB_GENS_DEFAULT;
                }
                this.extras_txt = liste.extras_txt || "";
                const savedExtras = liste.extras || [];
                for (const e of this.extras) { e.enabled = false; }
                for (const se of savedExtras) {
                    const local = this.extras.find(x => x.name === se.name);
                    if (local) { local.enabled = !!se.enabled; }
                }
                this.custom_items = liste.custom_items || [];
                this.updateListe();
                const adjs = liste.qty_adjustments || {};
                for (const r of this.liste_rayons) {
                    for (const it of r.items) {
                        if (Object.prototype.hasOwnProperty.call(adjs, it.name)) {
                            it.adj = adjs[it.name];
                        }
                    }
                }
                this._saveToLocalStorage();
            },

            // ── Shopping ──────────────────────────────────────────────────────
            _flatten(label) {
                const items = [];
                for (const r of this.liste_rayons) {
                    for (const it of r.items) {
                        items.push({rayon: r.name, name: it.name, qty_display: this.displayQty(it)});
                    }
                }
                return {items, label: label || ""};
            },

            async confirmShop() {
                if (this.shop_mode === "join") {
                    const raw = (this.shop_join_id || "").trim();
                    if (!raw) { return; }
                    const m = raw.match(/\/shop\/([a-f0-9]+)/i);
                    window.location = "/shop/" + (m ? m[1] : raw);
                    this.dialog = null;
                    return;
                }
                try {
                    const r = await fetch("/shopping-session", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify(this._flatten("")),
                    });
                    if (!r.ok) { throw new Error(await r.text()); }
                    const data = await r.json();
                    window.location = data.url;
                    this.dialog = null;
                } catch (e) {
                    this._toast("Erreur: " + e.message);
                }
            },

            // ── Misc ──────────────────────────────────────────────────────────
            _toast(msg) {
                this.toast = msg;
                clearTimeout(this._toastT);
                this._toastT = setTimeout(() => { this.toast = ""; }, 2500);
            },
        };
    }

    window.listeApp = listeApp;
})();
