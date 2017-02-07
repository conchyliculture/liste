var listeApp = angular.module('listeApp', ['ngSanitize','ngMaterial']);
listeApp.service('recettesService',
    function($http){
        this.getRecettesJsonData = function() {
            return $http({method: "GET", url: "/recettes.json"});
        };
        this.getRecettesMatinJsonData = function() {
            return $http({method: "GET", url: "/matin.json"});
        };
        this.getIngredientsJsonData = function() {
            // No .json here. Some stuff is being handled by the backend.
            return $http({method: "GET", url: "/ingredients"});
        };
});
listeApp.controller('ListeCtrl', ListeCtrl);
listeApp.controller('LoadCtrl', LoadCtrl);

range = function(max) {
    // No, JS has no such function. Thanks Obama.
    var res = [];
    for (var i=1; i<=max; i++) {res.push(i)};
    return res;
};

function ListeCtrl($scope, $http, $mdDialog, recettesService) {
    recettesService.getRecettesJsonData().then(
        // Calls the service to populate $scope.recettes
        function (r) {
            $scope.recettes = r.data['recettes'].sort(
                function(a,b){
                    return ((a.name < b.name) ? -1 : ((a.name > b.name) ? 1 : 0));
                }
            )
        }
    );
    recettesService.getRecettesMatinJsonData().then(
        // Calls the service to populate $scope.recettes_matin
        function (r) {
            $scope.recettes_matin = r.data['recettes'].sort(
                function(a,b){
                    return ((a.name < b.name) ? -1 : ((a.name > b.name) ? 1 : 0))
                }
            )
        }
    );
    recettesService.getIngredientsJsonData().then(
        // Calls the service to populate $scope.liste_ingredients
        function (r) {
            $scope.liste_ingredients = r.data;
        }
    );

    // Let's initialize some default values
    var nb_gens_default = 10;
    var liste_courses_json = []; // List of ingredients

    $scope.nb_jours = 5;
    $scope.range_jours = new Array($scope.nb_jours);
    $scope.range_jours_default = range(20);
    $scope.range_gens_default = range(25);

    $scope.extras = [
        {"name": "Capitain Morgan Spiced Rum", enabled: false,
            calc_qty:function() {return Math.ceil(parseInt($scope.nb_jours) / 2) },
            unit:" bouteilles (75cl)"},
        {"name": "Crème de marron (Clément Faugier)", enabled:false,
        // Un pot de 500gr pour 3 jours
            calc_qty:function() {return Math.ceil(parseInt($scope.nb_jours) / 3) },
            unit:" Pots (500g)"},
        {"name": "Fruits divers", enabled:false,
            // 0.5kg par jour
            calc_qty:function() {return $scope.nb_jours / 2 },
            unit:" kg (0.5*nb jours)"},
        {"name": "Gateau apéro", enabled:false,
            // 3 trucs par jour
            calc_qty:function() {return $scope.nb_jours * 3 },
            unit:" Paquets divers (chips, bretzels, etc)"},
        {"name": "Pastille lave-vaisselle", enabled:false,
            calc_qty:function() {return $scope.nb_jours * 2 },
            unit:" tablettes"},
        {"name": "Produit vaisselle", enabled:false,
            // 1 pour 5 jours
            calc_qty:function() {return Math.ceil($scope.nb_jours / 5) },
            unit:" bidon"},
        {"name": "PQ", enabled:false,
            // 1/4 rouleau par jour par personne arrondi au multiple de 6 supérieur
            calc_qty:function() {
                return Math.ceil(getNbGensTotal() * $scope.nb_jours / 24)*6},
            unit:" rouleaux"},
        {"name": "Sacs poubelle", enabled:false,
            calc_qty:function() {return Math.ceil($scope.nb_jours * 0.3) },
            unit:" rouleaux de 10"},
        {"name": "Saucisson", enabled:false,
            calc_qty:function() {return $scope.nb_jours * 3 },
            unit:" saucissons"},
        {"name": "Torchons", enabled:false,
            calc_qty:function() {return 2 },
            unit:" "},
        {"name": "Yaourts", enabled:false,
        // 1 Yaourts par personne et par jour arrondi au multipe de 6 supérieur 
            calc_qty:function() {
                return Math.ceil(getNbGensTotal() * $scope.nb_jours / 6)*6},
            unit:" pots de yaourts"},
    ];

    // These arrays will hold the nb person per day per meal recipes
    $scope.gens_par_matin = new Array($scope.nb_jours).fill(nb_gens_default);
    $scope.recette_matin_par_jour = new Array($scope.nb_jours).fill("");
    $scope.gens_par_diner = new Array($scope.nb_jours).fill(nb_gens_default);
    $scope.recette_diner_par_jour = new Array($scope.nb_jours).fill("");
    $scope.gens_par_dejeuner = new Array($scope.nb_jours).fill(nb_gens_default);
    $scope.recette_dejeuner_par_jour = new Array($scope.nb_jours).fill("");

    // Helper functions
    getRayon = function(ingredient_name) {
        // Returns 'rayon' of ingredient (from ingredients.json file)
        return $scope.liste_ingredients[ingredient_name]['rayon'];
    };

    getUnit = function(ingredient_name) {
        // Returns 'unit' of ingredient (from ingredients.json file)
        return $scope.liste_ingredients[ingredient_name]['unit'];
    };

    getNbGensTotal = function() {
        // Returns nb of gens total (makes a per day average, then averages that sum)
        var total = 0;
        for (var j = 0; j < $scope.nb_jours; j++) {
            var gens_today = 0;
            gens_today += $scope.gens_par_matin[j];
            gens_today += $scope.gens_par_dejeuner[j];
            gens_today += $scope.gens_par_diner[j];
            total += gens_today / 3
        };
        console.log(total);
        return Math.ceil(total / $scope.nb_jours);
    };

    getIngredients = function(recette_name, liste_recettes) {
        // Given the name of a recette, returns a list of ingredients objects.
        // This looks into the list of recipes in liste_recettes.
        // (Remember that mornings and other meals have different recettes.
        var ingredients = [];
        for (a in liste_recettes) {
            var r = liste_recettes[a];
            if (r.name == recette_name) {
                for (i in r.ingredients) {
                    var ing = r.ingredients[i];
                    ing['rayon'] = getRayon(ing['name']);
                    var u = getUnit(ing['name']);
                    if ((typeof u !== "undefined") & (u != "")) {
                        ing['unit'] = u;
                    }
                    ingredients.push(ing);
                }
            }
        }
        return ingredients;
    };

    arrondi = function(nb, unit) {
        // TODO: if unit is "", round to int
        // Rounds qty, depending on the unit given.
        // Ex: 1020g => 1Kg
        if ((typeof nb === "undefined") || (nb == null)){
            if ((typeof unit === "undefined") || (unit == null)) {
                return "";
            } else {
                return unit;
            }
        } else {
            if ((typeof unit === "undefined") || (unit == null)) {
                return nb
            }
        }
        var n = 0;
        switch(unit) {
            case "g":
                if (nb>=1000) {
                    n = Math.round(nb / 100) / 10;
                    return n+"kg";
                }
                break;
            case "cL":
                if (nb>=100) {
                    n = Math.round(nb / 10) / 10;
                    return n+"L";
                }
                break;
        }
        if (nb > 10) {
            return Math.round(nb)+""+unit;
       } else {
           return nb+unit;
       }
    }


    addToListe = function(liste_json, ingredient, nb_gens) {
        // Given a liste de courses, an ingredient object and the nb_gens for this meal,
        // adds the correct amount of this ingredient object to liste_json, which is the
        // internal object for the liste de courses, used by updateListe().
        var found = false;
        for (i in liste_json) {
            // First we check if we already have this ingredient in the liste de courses.
            var item = liste_json[i];
            if (item.name == ingredient.name) {
                if ('qty' in ingredient) {
                    item.qty = item.qty + (ingredient.qty * nb_gens);
                };
                found = true;
            };
        };
        if (!found) {
            var item = JSON.parse(JSON.stringify(ingredient)); // JS's way of cloning objects!
            if ('qty' in ingredient) {
                item.qty = ingredient.qty * nb_gens;
                item.unit = ingredient.unit;
            };
            liste_json.push(item);
        };
    };

    $scope.loadStoredList = function(json_from_http, name) {
        // takes the result from the Json representation of the liste de courses,
        // and populates the $scope var
        var jours = json_from_http['liste']['jours'];
        for (var i in jours) {
            // first, every day's meals
            var jour = jours[i]
            $scope.recette_matin_par_jour[i] = jour['matin']['recette'];
            $scope.gens_par_matin[i] = jour['matin']['gens'];
            $scope.recette_dejeuner_par_jour[i] = jour['dejeuner']['recette'];
            $scope.gens_par_dejeuner[i] = jour['dejeuner']['gens'];
            $scope.recette_diner_par_jour[i] = jour['diner']['recette'];
            $scope.gens_par_diner[i] = jour['diner']['gens'];
        };
        // then, 'extras'
        $scope.extras_txt = json_from_http['liste']['extras_txt'];
        var _extras = json_from_http['liste']['extras'];
        for (var i in _extras) {
            var extra = _extras[i];
            for (var j in $scope.extras) {
                var e = $scope.extras[j];
                if (e.name == extra.name) {e.enabled = extra.enabled}
            };
        };
        $scope.updateListe();
    };

    generate_saved_liste = function() {
        // Generates the JSON object which will be sent to the backend, to
        // store the liste de courses.
        var json_result = {'jours':[], 'extras':[], 'extras_txt':""};
        for (var i = 0; i < $scope.nb_jours; i++) {
            var jour = {'matin': {'recette':null, 'gens':0 }, 'diner': {'recette': null, 'gens': 0}, 'dejeuner': {'recette': null, 'gens': 0}};
            recette_matin = $scope.recette_matin_par_jour[i];
            recette_dejeuner = $scope.recette_dejeuner_par_jour[i];
            recette_diner = $scope.recette_diner_par_jour[i];
            jour['matin']['recette'] = recette_matin;
            jour['matin']['gens'] = $scope.gens_par_matin[i];
            jour['dejeuner']['recette'] = recette_dejeuner;
            jour['dejeuner']['gens'] = $scope.gens_par_dejeuner[i];
            jour['diner']['recette'] = recette_diner;
            jour['diner']['gens'] = $scope.gens_par_diner[i];

            json_result['jours'].push(jour);
        };
        for (var i in $scope.extras) {
            var extra = $scope.extras[i];
            var item = {'name': extra.name, 'enabled':extra.enabled};
            json_result['extras'].push(item);
        }
        json_result['extras_txt'] = $scope.extras_txt;
        return json_result;
    };

    $scope.updateListe = function() {
        // Updates the internal liste de course object
        liste_courses_json = [];
        for (var i=0; i < $scope.nb_jours; i++) {
            // First, this day's breakfast
            var recette_matin = $scope.recette_matin_par_jour[i];
            var gens_matin = $scope.gens_par_matin[i];
            if (recette_matin != "") {
                var ings = getIngredients(recette_matin, $scope.recettes_matin);
                for (ing in ings) {
                    ingredient = ings[ing];
                    addToListe(liste_courses_json, ingredient, gens_matin);
                }
            }

            // Then, this day's lunch
            var recette_dejeuner = $scope.recette_dejeuner_par_jour[i];
            var gens_dejeuner = $scope.gens_par_dejeuner[i];
            if (recette_dejeuner != "") {
                var ings = getIngredients(recette_dejeuner, $scope.recettes);
                for (ing in ings) {
                    ingredient = ings[ing];
                    addToListe(liste_courses_json, ingredient, gens_dejeuner);
                }
            };

            // Then, this day's diner
            var recette_diner = $scope.recette_diner_par_jour[i];
            var gens_diner = $scope.gens_par_diner[i];
            if (recette_diner != "") {
                var ings = getIngredients(recette_diner, $scope.recettes);
                for (ing in ings) {
                    ingredient = ings[ing];
                    addToListe(liste_courses_json, ingredient, gens_diner);
                }
            };
        };

        // Also all the extras
        for (var i in $scope.extras) {
            var liste_extras_json = [];
            var e = $scope.extras[i];
            if (e.enabled) {
                if (typeof e.calc_qty !== "undefined") {
                    e.qty = e.calc_qty();
                };
                addToListe(liste_courses_json, e, 1);
            };
        };
        updateHTMLListe(liste_courses_json);
    };

    updateHTMLListe = function(liste_json){
        // Generates the HTML code for the liste de course.
        var html_result = "<ul>\n";
        liste_json = liste_json.sort(
            function(a,b) {
                return ((a['rayon'] < b['rayon']) ? -1 : ((a['rayon'] > b['rayon']) ? 1 : 0));
            }
        );
        for (var i in liste_json) {
            var item = liste_json[i];
            var qty_txt = arrondi(item.qty, item.unit);
            html_result += "<ul>"+item.name
            if (qty_txt == "") {
                html_result += "</ul>\n" ;
            } else {
                html_result += ": "+qty_txt+"</ul>\n" ;
            }
        };
        html_result += "</ul>";
        $scope.liste_html = html_result;
    };

    $scope.joursChanged = function() {
        // Number of days have been changed.
        $scope.range_jours = new Array($scope.nb_jours);
        $scope.updateListe();
    }

    save = function(name) {
        $http({
            method: "POST",
            url: "/save",
            data: {'name' :name, "liste": generate_saved_liste()}
        }).then(
            function(response){
                // console.log('success');
                return response.body;
            },
            function(response){
                //console.log('fail');
            }
        );
    };
	$scope.showPromptSave = function(ev) {
        var confirm = $mdDialog.prompt()
        .title('Renseigner un nom pour la liste')
        .textContent('(ie: \'Kinzout 2019\')')
        .placeholder('Liste')
        .ariaLabel('Liste')
        .targetEvent(ev)
        .ok('Done!')
        .cancel('Cancel');

        $mdDialog.show(confirm).then(
            function(result) {
                save(result);
            },
            function() {console.log("Echec de save la liste")});
    };

	$scope.showPromptLoad = function($event) {
        var parentEl = angular.element(document.body);
        var confirm = $mdDialog.show({
            parent: parentEl,
            targetEvent: $event,
            controller: LoadCtrl,
            scope: $scope,
            templateUrl: 'loadtemplate.html',
            preserveScope: true,
            locals: {load_liste: $scope.load_liste},
            clickOutsideToClose: true
        });
    };
};

function LoadCtrl ($scope, $mdDialog, $http){
    // This controller handles the "Load" dialog
    $scope.loadhide = function() {$mdDialog.hide();};
    $scope.loadcancel = function() {$mdDialog.cancel();};
    $scope.loadanswer = function(answer) {
        var liste_name = "";
        liste_name = $scope.liste_select;
        fetch_stored_liste(liste_name);
        $mdDialog.hide(answer);
    };
    function fetch_stored_liste(list_name) {
        $http({
            method: "GET",
            url: "/get-stored-liste?name="+list_name,
        }).then(
            function(response){
                $scope.loadStoredList(response.data, list_name);
            },
            function(response){
                console.log('liste load fail');
            }
        );
    };

    function fetch_recettes() {
        $http({
            method: "GET",
            url: "/get-stored-listes",
        }).then(
            function(response){
                var data = response.data;
                $scope.load_liste=[];
                for (var i =0; i< data.length; i++) {
                    $scope.load_liste.push(data[i]['name']+" - "+data[i]['date']);
                };
                $scope.liste_select = $scope.load_liste[0];
            },
            function(response){ console.log('liste load fail'); }
        );
    };
    fetch_recettes();
};
