var listeApp = angular.module('listeApp', ['ngRoute', 'ngSanitize','ngMaterial']);
var recettes = [
    {   name:'Carbo',
        ingredients:  [
            { 'name': 'Spaghettis (De Cecco ou Barilla)', 'qty': 2000/15, 'unit':"g" },
            { 'name': 'Lardons', 'qty': 100, 'unit':"g" },
            { 'name': 'Oignons', 'qty': 50, 'unit':"g" },
            { 'name': 'Vin blanc genre muscadet', 'qty': 75/15, 'unit':"cL" },
            { 'name': 'Crème Fraiche', 'qty': 70/15, 'unit':"cL" },
            { 'name': 'Parmesan', 'qty': 500/15, 'unit':"g" },
            { 'name': 'Sel', 'unit':"g" },
            { 'name': 'Poivre', 'unit':"g" },
        ]
    },
    {   name:'Chili',
        ingredients:  [
            { 'name': 'Oignons', 'qty': 20, 'unit':"g" },
            { 'name': 'Ail', 'unit':"g" },
            { 'name': 'Poivrons', 'qty': 1/8, 'unit':"" },
            { 'name': 'Boîte de tomates pelées', 'qty': 60, 'unit':"g" },
            { 'name': 'Haricots rouges (en boîte, poids égoutté)', 'qty': 100, 'unit':"g" },
            { 'name': 'Boeuf haché', 'qty': 200, 'unit':"g" },
            { 'name': 'Bouillon cube', 'unit':"g" },
            { 'name': 'Huile d\'olive', 'unit':"g" },
            { 'name': 'Origan', 'unit':"g" },
            { 'name': 'Tabasco', 'unit':"g" },
            { 'name': 'Piment', 'unit':"g" },
            { 'name': 'Riz', 'qty': 150, 'unit':"g" },
        ]
    },
    {   name:'Croziflette',
        ingredients:  [
            { 'name': 'Lardons', 'qty': 100, 'unit':"g" },
            { 'name': 'Oignons', 'qty': 100, 'unit':"g" },
            { 'name': 'Crozets (moitié normaux moitié complets, pas de parfum à la con', 'qty': 100, 'unit':"g" },
            { 'name': 'Crème Fraiche', 'qty': 100, 'unit':"g" },
            { 'name': 'Reblochon (gros, fermier si possible)', 'qty': 0.2, 'unit':"" },
            { 'name': 'Râpé', 'qty': 50, 'unit':"g" },
            { 'name': 'Sel', 'unit':"g" },
            { 'name': 'Poivre', 'unit':"g" },
            { 'name': 'Beurre', 'unit':"g" },
        ]
    },
    {   name:'Omelette',
        ingredients:  [
            { 'name': 'Oeufs', 'qty': 2, 'unit':"" },
            { 'name': 'Champignons', 'qty': 150, 'unit':"g" },
            { 'name': 'Oignons', 'qty': 60, 'unit':"g" },
            { 'name': 'Râpé', 'qty': 50, 'unit':"g" },
            { 'name': 'Lardons', 'qty': 50, 'unit':"g" },
            { 'name': 'Crème Fraiche', 'qty': 0.1, 'unit':"cL" },
        ]
    },
    {   name:'Poulet champi crème',
        ingredients: [ { 'name': 'Riz', 'qty': 100, 'unit':"g" },
            { 'name': 'Râpé', 'qty': 50, 'unit':"g" },
            { 'name': 'Filet de poulet', 'qty': 1, 'unit':"" },
            { 'name': 'Vin blanc de cuisine', 'qty': 75/10, 'unit':"cL" },
            { 'name': 'Oignons', 'qty': 50, 'unit':"g" },
            { 'name': 'Crème Fraiche', 'qty': 5, 'unit':"cL" },
            { 'name': 'Champignons', 'qty': 150, 'unit':"g" },
            { 'name': 'Sel', 'unit':"g" },
            { 'name': 'Poivre', 'unit':"g" },
            { 'name': 'Beurre', 'unit':"g" },
        ]
    },
    {   name:'Raclette',
        ingredients:  [
            { 'name': 'Patates', 'qty': 3000/15, 'unit':"g" },
            { 'name': 'Fromage à raclette', 'qty': 4000/15, 'unit':"g" },
            { 'name': 'Cornichons', 'unit':"" },
            { 'name': 'Petits oignons', 'unit':"" },
            { 'name': 'Jambon blanc à la coupe', 'qty': 1, 'unit':"t" },
            { 'name': 'Rosette à la coupe', 'qty': 1, 'unit':"t" },
            { 'name': 'Coppa à la coupe', 'qty': 1, 'unit':"t" },
            { 'name': 'Viande des grisons à la coupe', 'qty': 700/15, 'unit':"g" },
            { 'name': 'Poivre', 'unit':"g" },
        ]
    },
    {   name:'Tartiflette',
        ingredients:  [
            { 'name': 'Lardons', 'qty': 100, 'unit':"g" },
            { 'name': 'Oignons', 'qty': 50, 'unit':"g" },
            { 'name': 'Patates', 'qty': 100, 'unit':"g" },
            { 'name': 'Crème Fraiche', 'qty': 5, 'unit':"cL" },
            { 'name': 'Reblochon', 'qty': 0.2, 'unit':"" },
            { 'name': 'Râpé', 'qty': 50, 'unit':"g" },
            { 'name': 'Sel', 'unit':"g" },
            { 'name': 'Poivre', 'unit':"g" },
            { 'name': 'Beurre', 'unit':"g" },
        ]
    },
];

range = function(max) {
    var res = [];
    for (var i=1; i<=max; i++) {res.push(i)};
    return res;
};

listeApp.controller('ListeCtrl', function ListeCtrl($scope, $http, $mdDialog) {
    $scope.recettes = recettes;
    $scope.nb_jours = "5"; // srsly!
    $scope.nb_gens = "10"; // srsly!
    $scope.jours_tab = range(20);
    $scope.gens_tab = range(25);

    $scope.gens_par_diner = new Array( parseInt($scope.nb_jours)).fill($scope.nb_gens);
    $scope.recette_diner_par_jour = new Array( parseInt($scope.nb_jours)).fill("");
    $scope.gens_par_dejeuner = new Array( parseInt($scope.nb_jours)).fill($scope.nb_gens);
    $scope.recette_dejeuner_par_jour = new Array( parseInt($scope.nb_jours)).fill("");

    var liste_json=[];

    getAll = function() {
        var recettes = [];
        for (var i = 0; i < $scope.nb_jours; i++) {
            var jour = {'diner': {'recette': null, 'gens': 0}, 'dejeuner': {'recette': null, 'gens': 0}};
            recette_dejeuner = $scope.recette_dejeuner_par_jour[i];
            recette_diner = $scope.recette_diner_par_jour[i];
            jour['dejeuner']['recette'] = recette_dejeuner;
            jour['diner']['recette'] = recette_diner;
            jour['dejeuner']['gens'] = parseInt($scope.gens_par_dejeuner[i]);
            jour['diner']['gens'] = parseInt($scope.gens_par_diner[i]);

            recettes.push(jour);
        }
        return recettes;
    };

    $scope.updateListe = function() {
        liste_json=[];
        for (var i = 0; i < $scope.nb_jours; i++) {
            recette_dejeuner = $scope.recette_dejeuner_par_jour[i];
            g = parseInt($scope.gens_par_dejeuner[i]);
            if (recette_dejeuner != "") {
                var ings = getIngredients(recette_dejeuner);
                for (ing in ings) {
                    ingredient = ings[ing];
                    addToListe(liste_json, ingredient, g);
                }
            }
            recette_diner = $scope.recette_diner_par_jour[i];
            g = parseInt($scope.gens_par_diner[i]);
            if (recette_diner != "") {
                var ings = getIngredients(recette_diner);
                for (ing in ings) {
                    ingredient = ings[ing];
                    addToListe(liste_json, ingredient, g);
                }
            }
        };
        changeListeText(liste_json);
    };

    changeListeText = function(j){
        h = "<ul>\n";
        for (var i in j) {
            var item = j[i];
            var qty_txt = arrondi(item.qty, item.unit);
            h += "<ul>"+item.name
            if (qty_txt == "") {
                h += "</ul>\n" ;
            } else {
                h += ": "+arrondi(item.qty, item.unit)+"</ul>\n" ;
            }
        }
        h+="</ul>";
        $scope.liste_html=h;
    }

    $scope.joursChanged = function() {
        $scope.jours = new Array(+$scope.nb_jours);
        var n = $scope.nb_gens_defaut;
        if (typeof n === "string") {
            $scope.gens_par_diner = new Array(parseInt($scope.nb_jours)).fill(n);
            $scope.recette_diner_par_jour = new Array( $scope.nb_jours);
            $scope.recette_dejeuner_par_jour = new Array( $scope.nb_jours);
        }

    }
    $scope.joursChanged();


    getIngredients = function(r) {
        for (a in recettes) {
            recette = recettes[a];
            if (recette.name == r) {
                return recette.ingredients;
            }
        }
    }

    arrondi = function(nb, unit) {
        if (unit == null){return '';}
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
        return Math.round(nb)+""+unit;
    }

    addToListe = function(liste, ing, nb) {
        var found = false;
        for (i in liste) {
            var item = liste[i];
            if (item.name == ing.name) {
                if ('qty' in ing) {
                    item.qty = item.qty + (ing.qty * nb);
                }
                found = true;
            }
        }
        if (!found) {
            //need to dupe, wtf
            var item = {};
            item.name = ing.name;
            if ('qty' in ing) {
                item.qty = ing.qty * nb;
                item.unit = ing.unit;
            }
            liste.push(item);
        }
    }

    save = function(name) {
        var config = { headers : {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8;'
            }
        };

        $http({
            method: "POST",
            url: "/save",
            data:{'name' :name, "recettes": getAll()}
        }).then(
       function(response){
           console.log('success');
           return response.body;
       },
       function(response){
           console.log('fail');
       }
    );
    };
	$scope.showPromptSave = function(ev) {
    // Appending dialog to document.body to cover sidenav in docs app
    var now = new Date();
    var now_string = now.getFullYear()+""+(now.getMonth()+1)+""+(now.getDay()+1)+"-"+now.getHours()+""+now.getMinutes()+""+now.getSeconds();
    var confirm = $mdDialog.prompt()
      .title('Select a name for your liste')
      .textContent('Bowser is a common name.')
      .placeholder('Liste')
      .ariaLabel('Liste')
      .initialValue(now_string)
      .targetEvent(ev)
      .ok('Okay!')
      .cancel('Cancel');

    $mdDialog.show(confirm).then(function(result) {
		// okay
		var res = save(result);
        console.log("saving");
        $scope.status = res;
    });

    };
});


