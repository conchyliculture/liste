var listeApp = angular.module('listeApp', ['ngSanitize']);
var recettes = [
    {
        name:'Poulet champi crème',
        ingredients: [
        {
            'name': 'Riz',
            'qty': 100,
            'unit':"g"
        },
        {
            'name': 'Filet de poulet',
            'qty': 1,
            'unit':""
        },
        {
            'name': 'Vin blanc de cuisine',
            'qty': 75/10,
            'unit':"cL"
        },
        {
            'name': 'Oignons',
            'qty': 50,
            'unit':"g"
        },
        {
            'name': 'Crème fraiche',
            'qty': 100/14,
            'unit':"cL"
        },
        {
            'name': 'Champignons',
            'qty': 100,
            'unit':"g"
        }
        ]
    },
    {
        name:'Tartiflette',
        ingredients:  [
            {
                'name': 'Patates',
                'qty': 100,
                'unit':"g"
            },
            {
                'name': 'Crème Fraiche',
                'qty': 100,
                'unit':"g"
            },
            {
                'name': 'Reblochon',
                'qty': 0.2,
                'unit':""
            },
        ]
    },
];

range = function(max) {
    var res = [];
    for (var i=1; i<=max; i++) {res.push(i)};
    return res;
};

listeApp.controller('ListeCtrl', function ListeCtrl($scope) {
    $scope.recettes = recettes;
    $scope.nb_jours = "5"; // srsly!
    $scope.nb_gens = "10"; // srsly!
    $scope.jours_tab = range(20); 
    $scope.gens_tab = range(25); 

    $scope.gens_par_jour = new Array( parseInt($scope.nb_jours)).fill($scope.nb_gens);
    $scope.recette_par_jour = new Array( parseInt($scope.nb_jours)).fill("");

    var liste_json=[];


    $scope.updateListe = function() {
        liste_json=[];
        for (var i = 0; i < $scope.nb_jours; i++) {
            r = $scope.recette_par_jour[i];
            g = parseInt($scope.gens_par_jour[i]);
            if (r == "") {
                continue;
            }
            var ings = getIngredients(r);
            for (ing in ings) {
                ingredient = ings[ing]; 
                addToListe(liste_json, ingredient, g);
            }
        };
        changeListeText(liste_json);
    };

    changeListeText = function(j){
        h = "<ul>\n";
        for (var i in j) {
            var item = j[i];
            console.log(item);
            h += "<ul>"+item.name+": "+arrondi(item.qty, item.unit)+"</ul>\n" ;
        }
        h+="</ul>";
        $scope.liste_html=h;
    }

    $scope.joursChanged = function() {
        $scope.jours = new Array(+$scope.nb_jours);
        var n = $scope.nb_gens_defaut;
        if (typeof n === "string") {
            $scope.gens_par_jour = new Array(parseInt($scope.nb_jours)).fill(n);
            $scope.recette_par_jour = new Array( $scope.nb_jours);
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
        console.log(nb+" "+unit);
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
        console.log("pour "+nb);
        console.log(ing);
        var found = false;
        for (i in liste) {
            var item = liste[i];
            if (item.name == ing.name) {
                item.qty = item.qty + (ing.qty * nb);
                found = true;
            }
        }
        if (!found) {
            //need to dupe, wtf
            var item = {};
            item.name = ing.name;
            item.qty = ing.qty * nb;
            item.unit = ing.unit;
            liste.push(item);
        }
        console.log(liste);
    }

});


