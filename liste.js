var listeApp = angular.module('listeApp', []);
var recettes = [
    {
        name:'Poulet champi crème',
        ingredients: [
        {
            'name': 'Filet de poulet',
            'qty': 1,
            'unit':""
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


function getIngredients(r) {
    for (a in recettes) {
        recette = recettes[a];
        if (recette.name == r) {
            return recette.ingredients;
        }
    }
}

function addToListe(liste, i, nb) {
    if (i.name in liste) {
        var cur_qty =  liste[i.name];
        liste[i.name] = cur_qty + i.qty * nb;
    } else {
        liste[i.name] = i.qty * nb; 
    }
    return liste;
}
range = function(max) {
    var res = [];
    for (var i=1; i<=max; i++) {res.push(i)};
    return res;
};

listeApp.controller('ListeCtrl', function ListeCtrl($scope) {
    $scope.recettes = recettes;
    $scope.liste_text="Liste ";
    $scope.nb_jours = "5"; // srsly!
    $scope.nb_gens = "10"; // srsly!
    $scope.jours_tab = range(20); 
    $scope.gens_tab = range(25); 

    $scope.gens_par_jour = new Array( parseInt($scope.nb_jours)).fill($scope.nb_gens);
    console.log($scope.gens_par_jour);
    $scope.recette_par_jour = new Array( parseInt($scope.nb_jours)).fill("");


    $scope.updateListe = function() {
        var liste_json={};
        var all_ingredients={};
        for (i = 0; i < $scope.nb_jours; i++) {
            r = $scope.recette_par_jour[i];
            g = $scope.gens_par_jour[i];
            if (r == "") {
                continue;
            }
            var ings = getIngredients(r)
            for (ing in ings) {
                ingredient = ings[ing]; 
                addToListe(liste_json, ingredient, g);
            };
        };
        console.log(liste_json);
    };

    $scope.joursChanged = function() {
        $scope.jours = new Array(+$scope.nb_jours);
        var n = $scope.nb_gens_defaut;
        if (typeof n === "string") {
            $scope.gens_par_jour = new Array(parseInt($scope.nb_jours)).fill(n);
            $scope.recette_par_jour = new Array( $scope.nb_jours);
        }

    }
    $scope.joursChanged();

});


