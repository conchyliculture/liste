var listeApp = angular.module('listeApp', ['ngSanitize','ngMaterial']);
listeApp.service('recettesService',
    function($http){
        this.getRecettesJsonData = function() {
            return $http({method: "GET", url: "/recettes.json"});
        };
        this.getRecettesMatinJsonData = function() {
            return $http({method: "GET", url: "/matin.json"});
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

    $scope.extras = [
        {"name": "PQ", enabled:false,
            calc_qty:function() {return parseInt($scope.nb_jours) * 6 },
            unit:" rouleau (6*nb jours)"},
        {"name": "Saucisson", enabled:false,
            calc_qty:function() {return parseInt($scope.nb_jours) * 3 },
            unit:" saucissons (3*nb jours)"},
        {"name": "Gateau apéro", enabled:false,
            calc_qty:function() {return parseInt($scope.nb_jours) * 3 },
            unit:" saucissons (3*nb jours)"},
        {"name": "Gateau apéro", enabled:false,
            calc_qty:function() {return parseInt($scope.nb_jours) * 3 },
            unit:" Paquets divers (chips, bretzels, etc) (3*nb jours)"},
        {"name": "Sacs poubelle", enabled:false,
            calc_qty:function() {return Math.round(parseInt($scope.nb_jours) * 0.3) },
            unit:" rouleaux (3 sacs * nb jours)"},
        {"name": "Torchons", enabled:false,
            calc_qty:function() {return 2 },
            unit:" "},
        {"name": "Produit vaisselle", enabled:false,
            calc_qty:function() {return Math.ceil(parseInt($scope.nb_jours) / 5) },
            unit:" bidon (1 pour 5 jours)"},
        {"name": "Pastille lave-vaisselle", enabled:false,
            calc_qty:function() {return parseInt($scope.nb_jours) * 2 },
            unit:" (2*nb jours)"},
        {"name": "Fruits divers", enabled:false,
            calc_qty:function() {return parseInt($scope.nb_jours) / 2 },
            unit:" kg (0.5*nb jours)"},
        {"name": "Yaourts", enabled:false,
    // TODO avoir une moyenne de gens par jour
            calc_qty:function() {return parseInt($scope.nb_jours)  },
            unit:" * nb_gens == nb pots"},
        {"name": "Crème de marron", enabled:false,
        // TODO avoir une moyenne de gens par jour
            calc_qty:function() {return parseInt($scope.nb_jours) * 3 },
            unit:" Plein (1 plein par jour)"},
        {"name": "Capitaaaaaine", enabled: false,
            calc_qty:function() {return parseInt($scope.nb_jours) / 2  },
            unit:" bouteilles (1 pour 2 jours)"},
    ];

    // Let's initialize some default values
    var nb_gens_default = "10"; // srsly, we need a string!
    var liste_courses_json = []; // List of ingredients

    $scope.nb_jours = "5"; // srsly, we need a string!
    $scope.range_jours_default = range(20);
    $scope.range_gens_default = range(25);

    // These arrays will hold the nb person per day per meal recipes
    $scope.gens_par_matin = new Array(parseInt($scope.nb_jours)).fill(nb_gens_default);
    $scope.recette_matin_par_jour = new Array(parseInt($scope.nb_jours)).fill("");
    $scope.gens_par_diner = new Array( parseInt($scope.nb_jours)).fill(nb_gens_default);
    $scope.recette_diner_par_jour = new Array( parseInt($scope.nb_jours)).fill("");
    $scope.gens_par_dejeuner = new Array( parseInt($scope.nb_jours)).fill(nb_gens_default);
    $scope.recette_dejeuner_par_jour = new Array( parseInt($scope.nb_jours)).fill("");

    // Helper functions
    getIngredients = function(recette_name, liste_recettes) {
        for (a in liste_recettes) {
            var r = liste_recettes[a];
            if (r.name == recette_name) { return r.ingredients; }
        }
    };

    arrondi = function(nb, unit) {
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
        var found = false;
        for (i in liste_json) {
            var item = liste_json[i];
            if (item.name == ingredient.name) {
                if ('qty' in ingredient) {
                    item.qty = item.qty + (ingredient.qty * nb_gens);
                };
                found = true;
            };
        };
        if (!found) {
            var item = {};
            item.name = ingredient.name;
            if ('qty' in ingredient) {
                item.qty = ingredient.qty * nb_gens;
                item.unit = ingredient.unit;
            };
            liste_json.push(item);
        };
    };

    $scope.loadStoredList = function(json_from_http, name) {
        // takes the result from the HTTP json, and populates the local $scope var
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
        var _extras = json_from_http['liste']['extras'];
        var setExtraState = function(extra_name, state) {
            for (var i=0; i < $scope.extras.length; i++) {
                var e = $scope.extras[i];
                if (e.name == extra_name) {e.enabled = state}
            }
        };
        for (var i = 0; i < _extras.length; i++) {
            var extra = _extras[i];
            console.log(extra);
            setExtraState(extra.name, extra.enabled);
        };
        $scope.updateListe();
    };

    generate_saved_liste = function() {
        // Generates the JSON object used for storage of the list
        var json_result = {'jours':[], 'extras':[]};
        for (var i = 0; i < $scope.nb_jours; i++) {
            var jour = {'matin': {'recette':null, 'gens':0 }, 'diner': {'recette': null, 'gens': 0}, 'dejeuner': {'recette': null, 'gens': 0}};
            recette_matin = $scope.recette_matin_par_jour[i];
            recette_dejeuner = $scope.recette_dejeuner_par_jour[i];
            recette_diner = $scope.recette_diner_par_jour[i];
            jour['matin']['recette'] = recette_matin;
            jour['matin']['gens'] = parseInt($scope.gens_par_matin[i]);
            jour['dejeuner']['recette'] = recette_dejeuner;
            jour['dejeuner']['gens'] = parseInt($scope.gens_par_dejeuner[i]);
            jour['diner']['recette'] = recette_diner;
            jour['diner']['gens'] = parseInt($scope.gens_par_diner[i]);

            json_result['jours'].push(jour);
        };
        for (var i in $scope.extras) {
            var extra = $scope.extras[i];
            var item = {'name': extra.name, 'enabled':extra.enabled};
            json_result['extras'].push(item);
        }
        return json_result;
    };

    $scope.updateListe = function() {
        // Re-builds the internal liste de course
        liste_courses_json = [];
        for (var i in $scope.nb_jours) {
            var recette_matin = $scope.recette_matin_par_jour[i];
            var gens_matin = parseInt($scope.gens_par_matin[i]);
            if (recette_matin != "") {
                var ings = getIngredients(recette_matin, $scope.recettes_matin);
                for (ing in ings) {
                    ingredient = ings[ing];
                    addToListe(liste_courses_json, ingredient, gens_matin);
                }
            }

            var recette_dejeuner = $scope.recette_dejeuner_par_jour[i];
            var gens_dejeuner = parseInt($scope.gens_par_dejeuner[i]);
            if (recette_dejeuner != "") {
                var ings = getIngredients(recette_dejeuner, $scope.recettes);
                for (ing in ings) {
                    ingredient = ings[ing];
                    addToListe(liste_courses_json, ingredient, g);
                }
            };

            var recette_diner = $scope.recette_diner_par_jour[i];
            var gens_diner = parseInt($scope.gens_par_diner[i]);
            if (recette_diner != "") {
                var ings = getIngredients(recette_diner, $scope.recettes);
                for (ing in ings) {
                    ingredient = ings[ing];
                    addToListe(liste_courses_json, ingredient, gens_diner);
                }
            };
        };

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
        var html_result = "<ul>\n";
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
        // Update number of days
        $scope.jours = new Array(+$scope.nb_jours);
        var n = $scope.nb_gens_defaut;
        var nb = parseInt($scope.nb_jours);
        $scope.gens_par_matin = new Array(nb).fill(n);
        $scope.gens_par_dejeuner = new Array(nb).fill(n);
        $scope.gens_par_diner = new Array(nb).fill(n);
        $scope.recette_matin_par_jour = new Array($scope.nb_jours);
        $scope.recette_diner_par_jour = new Array($scope.nb_jours);
        $scope.recette_dejeuner_par_jour = new Array( $scope.nb_jours);
    }

    // Needed, or we don't have the initial default number of days displayed
    $scope.joursChanged();

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
