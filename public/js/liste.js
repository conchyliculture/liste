(function () {
    "use strict";

    Object.defineProperty(Array.prototype, "sortDesc", {
        enumerable: false,
        value: function (key) {
            this.sort(function (a, b) {
                return a[key] > b[key] ? -1 : a[key] < b[key] ? 1 : 0;
            });
        }
    });

    var listeApp = angular.module("listeApp", ["ngSanitize", "ngMaterial"]);

    listeApp.directive("focusOn", function ($timeout) {
        return function (scope, elem, attr) {
            scope.$watch(attr.focusOn, function (val) {
                if (val) { $timeout(function () { elem[0].focus(); elem[0].select(); }); }
            });
        };
    });

    listeApp.service("recettesService", function ($http) {
        this.getRecettesJsonData      = function () { return $http.get("/recettes.json"); };
        this.getRecettesMatinJsonData  = function () { return $http.get("/matin.json"); };
        this.getIngredientsJsonData    = function () { return $http.get("/ingredients"); };
        this.getRayons                 = function () { return $http.get("/rayons"); };
    });

    listeApp.controller("ListeCtrl", ListeCtrl);
    listeApp.controller("LoadCtrl",  LoadCtrl);
    listeApp.controller("ShoppingCtrl", ShoppingCtrl);

    // ── ListeCtrl ─────────────────────────────────────────────────────────────

    function ListeCtrl($scope, $http, $mdDialog, recettesService) {

        recettesService.getRecettesJsonData().then(function (r) {
            $scope.recettes = r.data["recettes"].sort(function (a, b) {
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
            });
        });
        recettesService.getRecettesMatinJsonData().then(function (r) {
            $scope.recettes_matin = r.data["recettes"].sort(function (a, b) {
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
            });
        });
        recettesService.getIngredientsJsonData().then(function (r) {
            $scope.liste_ingredients = r.data;
        });
        recettesService.getRayons().then(function (r) {
            $scope.enum_rayon = r.data;
        });

        var nb_gens_default    = 10;
        var liste_courses_json = [];

        $scope.nb_jours            = 5;
        $scope.range_jours         = new Array($scope.nb_jours);
        $scope.enum_rayon          = [];
        $scope.custom_items        = [];
        $scope.new_item            = {name: "", qty: "", unit: "", rayon: null};
        $scope.range_jours_default = ListeHelpers.range(20);
        $scope.range_gens_default  = ListeHelpers.range(25);

        $scope.extras = [
            {name: "Capitain Morgan Spiced Rum", enabled: false,
                calc_qty: function () { return Math.ceil(parseInt($scope.nb_jours) / 2); },
                unit: " bouteilles (75cl)"},
            {name: "Crème de marron (Clément Faugier)", enabled: false,
                calc_qty: function () { return Math.ceil(parseInt($scope.nb_jours) / 3); },
                unit: " Pots (500g)"},
            {name: "Fruits divers", enabled: false,
                calc_qty: function () { return $scope.nb_jours / 2; },
                unit: " kg (0.5*nb jours)"},
            {name: "Gateau apéro", enabled: false,
                calc_qty: function () { return $scope.nb_jours * 3; },
                unit: " Paquets divers (chips, bretzels, etc)"},
            {name: "Pastille lave-vaisselle", enabled: false,
                calc_qty: function () { return $scope.nb_jours * 2; },
                unit: " tablettes"},
            {name: "Produit vaisselle", enabled: false,
                calc_qty: function () { return Math.ceil($scope.nb_jours / 5); },
                unit: " bidon"},
            {name: "PQ", enabled: false,
                calc_qty: function () { return Math.ceil(getNbGensTotal() * $scope.nb_jours / 24) * 6; },
                unit: " rouleaux"},
            {name: "Sacs poubelle", enabled: false,
                calc_qty: function () { return Math.ceil($scope.nb_jours * 0.3); },
                unit: " rouleaux de 10"},
            {name: "Pain", enabled: false,
                calc_qty: function () { return getNbGensTotal(); },
                unit: " "},
            {name: "Saucisson", enabled: false,
                calc_qty: function () { return $scope.nb_jours * 3; },
                unit: " saucissons"},
            {name: "Torchons", enabled: false,
                calc_qty: function () { return 2; },
                unit: " "},
            {name: "Yaourts", enabled: false,
                calc_qty: function () { return Math.ceil(getNbGensTotal() * $scope.nb_jours / 6) * 6; },
                unit: " pots de yaourts"},
        ];

        $scope.recette_matin             = "";
        $scope.gens_par_matin            = new Array($scope.nb_jours).fill(nb_gens_default);
        $scope.gens_par_diner            = new Array($scope.nb_jours).fill(nb_gens_default);
        $scope.recette_diner_par_jour    = new Array($scope.nb_jours).fill("");
        $scope.gens_par_dejeuner         = new Array($scope.nb_jours).fill(nb_gens_default);
        $scope.recette_dejeuner_par_jour = new Array($scope.nb_jours).fill("");

        // ── $scope-dependent helpers (private) ────────────────────────────────

        var getRayon = function (ingredient_name) {
            return $scope.liste_ingredients[ingredient_name]["rayon"];
        };

        var getUnit = function (ingredient_name) {
            return $scope.liste_ingredients[ingredient_name]["unit"];
        };

        var getNbGensTotal = function () {
            var total = 0;
            for (var j = 0; j < $scope.nb_jours; j++) {
                total += ($scope.gens_par_matin[j] + $scope.gens_par_dejeuner[j] + $scope.gens_par_diner[j]) / 3;
            }
            return Math.ceil(total / $scope.nb_jours);
        };

        var getIngredients = function (recette_name, liste_recettes) {
            var ingredients = [];
            for (var a = 0; a < liste_recettes.length; a++) {
                var r = liste_recettes[a];
                if (r.name === recette_name) {
                    for (var i = 0; i < r.ingredients.length; i++) {
                        var ing = r.ingredients[i];
                        ing["rayon"] = getRayon(ing["name"]);
                        var u = getUnit(ing["name"]);
                        if (typeof u !== "undefined" && u !== "") { ing["unit"] = u; }
                        ingredients.push(ing);
                    }
                }
            }
            return ingredients;
        };

        var generate_saved_liste = function () {
            var json_result = {jours: [], extras: [], extras_txt: ""};
            for (var i = 0; i < $scope.nb_jours; i++) {
                var recette_dejeuner = $scope.recette_dejeuner_par_jour[i];
                var recette_diner    = $scope.recette_diner_par_jour[i];
                json_result.jours.push({
                    matin:    {recette: $scope.recette_matin, gens: $scope.gens_par_matin[i]},
                    dejeuner: {recette: recette_dejeuner,     gens: $scope.gens_par_dejeuner[i]},
                    diner:    {recette: recette_diner,        gens: $scope.gens_par_diner[i]}
                });
            }
            for (var i = 0; i < $scope.extras.length; i++) {
                json_result.extras.push({name: $scope.extras[i].name, enabled: $scope.extras[i].enabled});
            }
            json_result.extras_txt   = $scope.extras_txt;
            json_result.custom_items = $scope.custom_items;
            var adjs   = {};
            var rayons = $scope.liste_rayons || [];
            for (var i = 0; i < rayons.length; i++) {
                for (var j = 0; j < rayons[i].items.length; j++) {
                    var item = rayons[i].items[j];
                    if (item.adj !== 0) { adjs[item.name] = item.adj; }
                }
            }
            json_result.qty_adjustments = adjs;
            return json_result;
        };

        // Rebuilds $scope.liste_rayons from a flat ingredient list.
        // Carries adj and in-progress qty edits over from the previous render.
        var updateHTMLListe = function (liste_json) {
            var prevAdj  = {};
            var prevEdit = {};
            var prevRayons = $scope.liste_rayons || [];
            for (var i = 0; i < prevRayons.length; i++) {
                for (var j = 0; j < prevRayons[i].items.length; j++) {
                    var prev = prevRayons[i].items[j];
                    if (prev.adj !== 0) { prevAdj[prev.name] = prev.adj; }
                    if (prev.editing)   { prevEdit[prev.name] = {editVal: prev.editVal}; }
                }
            }
            liste_json = liste_json.sort(function (a, b) {
                var ai = a.rayon !== null ? a.rayon : 999;
                var bi = b.rayon !== null ? b.rayon : 999;
                return ai - bi;
            });
            var rayons       = [];
            var currentRayon = null;
            for (var i = 0; i < liste_json.length; i++) {
                var item = liste_json[i];
                if (item.rayon !== currentRayon) {
                    currentRayon = item.rayon;
                    rayons.push({name: ($scope.enum_rayon || [])[currentRayon] || "", items: []});
                }
                var adj = prevAdj[item.name] || 0;
                if (typeof item.qty !== "undefined" && item.qty + adj < 0) { adj = -item.qty; }
                var itemObj = {name: item.name, base_qty: item.qty, adj: adj, unit: item.unit};
                if (prevEdit[item.name]) {
                    itemObj.editing = true;
                    itemObj.editVal = prevEdit[item.name].editVal;
                }
                rayons[rayons.length - 1].items.push(itemObj);
            }
            $scope.liste_rayons = rayons;
        };

        var save = function (name) {
            $http.post("/save", {name: name, liste: generate_saved_liste()});
        };

        // ── $scope methods ────────────────────────────────────────────────────

        $scope.toggleListe = function () {
            angular.element(document.getElementById("columnMid")).toggleClass("hide");
            angular.element(document.getElementById("columnRight")).toggleClass("hide");
        };

        $scope.loadStoredList = function (json_from_http) {
            var liste = json_from_http["liste"];
            var jours = liste["jours"];
            $scope.nb_jours = jours.length;
            for (var i = 0; i < jours.length; i++) {
                var jour = jours[i];
                $scope.gens_par_matin[i]            = jour["matin"]["gens"];
                $scope.recette_matin                 = jour["matin"]["recette"];
                $scope.recette_dejeuner_par_jour[i]  = jour["dejeuner"]["recette"];
                $scope.gens_par_dejeuner[i]          = jour["dejeuner"]["gens"];
                $scope.recette_diner_par_jour[i]     = jour["diner"]["recette"];
                $scope.gens_par_diner[i]             = jour["diner"]["gens"];
            }
            $scope.extras_txt = liste["extras_txt"];
            var _extras = liste["extras"] || [];
            for (var i = 0; i < _extras.length; i++) {
                for (var j = 0; j < $scope.extras.length; j++) {
                    if ($scope.extras[j].name === _extras[i].name) {
                        $scope.extras[j].enabled = _extras[i].enabled;
                    }
                }
            }
            $scope.custom_items = liste["custom_items"] || [];
            $scope.updateListe();
            var adjs   = liste["qty_adjustments"] || {};
            var rayons = $scope.liste_rayons || [];
            for (var i = 0; i < rayons.length; i++) {
                for (var j = 0; j < rayons[i].items.length; j++) {
                    var item = rayons[i].items[j];
                    if (adjs[item.name] !== undefined) { item.adj = adjs[item.name]; }
                }
            }
        };

        $scope.updateListe = function () {
            liste_courses_json = [];
            for (var i = 0; i < $scope.nb_jours; i++) {
                var ings;
                var gens_matin = $scope.gens_par_matin[i];
                if ($scope.recette_matin !== "") {
                    ings = getIngredients($scope.recette_matin, $scope.recettes_matin);
                    for (var k = 0; k < ings.length; k++) { ListeHelpers.addToListe(liste_courses_json, ings[k], gens_matin); }
                }
                var recette_dejeuner = $scope.recette_dejeuner_par_jour[i];
                var gens_dejeuner    = $scope.gens_par_dejeuner[i];
                if (recette_dejeuner !== "") {
                    ings = getIngredients(recette_dejeuner, $scope.recettes);
                    for (var k = 0; k < ings.length; k++) { ListeHelpers.addToListe(liste_courses_json, ings[k], gens_dejeuner); }
                }
                var recette_diner = $scope.recette_diner_par_jour[i];
                var gens_diner    = $scope.gens_par_diner[i];
                if (recette_diner !== "") {
                    ings = getIngredients(recette_diner, $scope.recettes);
                    for (var k = 0; k < ings.length; k++) { ListeHelpers.addToListe(liste_courses_json, ings[k], gens_diner); }
                }
            }
            for (var i = 0; i < $scope.extras.length; i++) {
                var e = $scope.extras[i];
                if (e.enabled) {
                    if (typeof e.calc_qty !== "undefined") { e.qty = e.calc_qty(); }
                    ListeHelpers.addToListe(liste_courses_json, e, 1);
                }
            }
            for (var i = 0; i < $scope.custom_items.length; i++) {
                ListeHelpers.addToListe(liste_courses_json, $scope.custom_items[i], 1);
            }
            updateHTMLListe(liste_courses_json);
        };

        $scope.stepForUnit = function (unit) {
            return {g: 100, cL: 25, L: 1}[unit] || 1;
        };

        $scope.displayQty = function (item) {
            if (typeof item.base_qty === "undefined") { return ""; }
            return ListeHelpers.arrondi(item.base_qty + item.adj, item.unit);
        };

        $scope.adjustQty = function (item, dir) {
            if (typeof item.base_qty === "undefined") { return; }
            var step = $scope.stepForUnit(item.unit);
            item.adj += dir * step;
            if (item.base_qty + item.adj < 0) { item.adj = -item.base_qty; }
        };

        $scope.startEditQty = function (item) {
            item.editVal = item.base_qty + item.adj;
            item.editing = true;
        };

        $scope.commitEditQty = function (item) {
            var v = Number(item.editVal);
            if (!isNaN(v) && v >= 0) { item.adj = v - item.base_qty; }
            item.editing = false;
        };

        $scope.cancelEditQty = function (item) { item.editing = false; };

        $scope.addCustomItem = function () {
            var name = $scope.new_item.name.trim();
            if (!name) { return; }
            var qty  = $scope.new_item.qty !== "" ? Number($scope.new_item.qty) : undefined;
            var item = {name: name, unit: $scope.new_item.unit, rayon: $scope.new_item.rayon};
            if (typeof qty !== "undefined") { item.qty = qty; }
            $scope.custom_items.push(item);
            $scope.new_item = {name: "", qty: "", unit: "", rayon: null};
            $scope.updateListe();
        };

        $scope.removeCustomItem = function (idx) {
            $scope.custom_items.splice(idx, 1);
            $scope.updateListe();
        };

        $scope.joursChanged = function () {
            var old_len = $scope.gens_par_matin.length;
            $scope.range_jours = new Array($scope.nb_jours);
            for (var i = old_len; i < $scope.nb_jours; i++) {
                $scope.gens_par_matin[i]            = nb_gens_default;
                $scope.gens_par_dejeuner[i]         = nb_gens_default;
                $scope.gens_par_diner[i]            = nb_gens_default;
                $scope.recette_dejeuner_par_jour[i] = "";
                $scope.recette_diner_par_jour[i]    = "";
            }
            $scope.updateListe();
        };

        $scope.flattenListeRayons = flattenListeRayons;
        function flattenListeRayons(label) {
            var items  = [];
            var rayons = $scope.liste_rayons || [];
            for (var i = 0; i < rayons.length; i++) {
                var rayon = rayons[i];
                for (var j = 0; j < rayon.items.length; j++) {
                    var item = rayon.items[j];
                    items.push({rayon: rayon.name, name: item.name, qty_display: $scope.displayQty(item)});
                }
            }
            return {items: items, label: label || ""};
        }

        $scope.startShoppingCurrent = function () {
            $mdDialog.show({
                controller: ShoppingCtrl,
                templateUrl: "shoptemplate.html",
                parent: angular.element(document.body),
                clickOutsideToClose: true
            }).then(function (result) {
                if (result === "create") {
                    var payload = flattenListeRayons("");
                    $http.post("/shopping-session", payload).then(
                        function (r) { window.open(r.data.url, "_blank"); },
                        function ()  { alert("Impossible de créer la session de courses."); }
                    );
                } else if (result && result.action === "join") {
                    window.open("/shop/" + result.id, "_blank");
                }
            }, angular.noop);
        };

        $scope.showPromptSave = function (ev) {
            $mdDialog.show(
                $mdDialog.prompt()
                    .title("Renseigner un nom pour la liste")
                    .textContent("(ie: 'Kinzout 2019')")
                    .placeholder("Liste")
                    .ariaLabel("Liste")
                    .targetEvent(ev)
                    .ok("Done!")
                    .cancel("Cancel")
            ).then(function (result) { save(result); }, angular.noop);
        };

        $scope.showPromptLoad = function ($event) {
            $mdDialog.show({
                parent: angular.element(document.body),
                targetEvent: $event,
                controller: LoadCtrl,
                scope: $scope,
                templateUrl: "loadtemplate.html",
                preserveScope: true,
                locals: {load_liste: $scope.load_liste},
                clickOutsideToClose: true
            });
        };
    }

    // ── LoadCtrl ──────────────────────────────────────────────────────────────

    function LoadCtrl($scope, $mdDialog, $http) {
        $scope.loadhide   = function () { $mdDialog.hide(); };
        $scope.loadcancel = function () { $mdDialog.cancel(); };
        $scope.loadanswer = function (answer) {
            $scope.loadStoredList($scope.liste_select);
            $mdDialog.hide(answer);
        };

        $scope.startShopping = function () {
            $mdDialog.show({
                controller: ShoppingCtrl,
                templateUrl: "shoptemplate.html",
                parent: angular.element(document.body),
                clickOutsideToClose: true
            }).then(function (result) {
                if (result === "create") {
                    var label = $scope.liste_select ? $scope.liste_select.name : "";
                    $scope.loadStoredList($scope.liste_select);
                    var payload = $scope.flattenListeRayons(label);
                    $http.post("/shopping-session", payload).then(
                        function (r) { window.open(r.data.url, "_blank"); $mdDialog.hide(); },
                        function ()  { alert("Impossible de créer la session de courses."); }
                    );
                } else if (result && result.action === "join") {
                    window.open("/shop/" + result.id, "_blank");
                    $mdDialog.hide();
                }
            }, angular.noop);
        };

        function fetch_stored_listes() {
            $http.get("/get-stored-listes").then(
                function (response) {
                    $scope.load_liste = response.data.slice();
                    $scope.load_liste.sortDesc("date");
                    $scope.liste_select = $scope.load_liste[0];
                },
                function () { console.log("listes load fail"); }
            );
        }
        fetch_stored_listes();
    }

    // ── ShoppingCtrl ──────────────────────────────────────────────────────────

    function ShoppingCtrl($scope, $mdDialog) {
        $scope.joinMode = false;
        $scope.form     = {joinId: ""};

        $scope.cancel   = function () { $mdDialog.cancel(); };
        $scope.create   = function () { $mdDialog.hide("create"); };
        $scope.showJoin = function () { $scope.joinMode = true; };
        $scope.hideJoin = function () { $scope.joinMode = false; };

        $scope.join = function () {
            var raw = $scope.form.joinId.trim();
            var m   = raw.match(/\/shop\/([a-f0-9]+)/i);
            $mdDialog.hide({action: "join", id: m ? m[1] : raw});
        };

        $scope.joinOnEnter = function (e) {
            if (e.key === "Enter" && $scope.form.joinId.trim()) { $scope.join(); }
        };
    }

})();
