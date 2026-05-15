var app = angular.module('recettesEditorApp', ['ngMaterial', 'ngSanitize']);

app.controller('EditorCtrl', function($scope, $http, $mdDialog, $mdToast) {
    $scope.tabIndex = 0;
    $scope.recettes = [];
    $scope.recettes_matin = [];
    $scope.ingredientNames = [];
    $scope.selected = null;

    // ingredient catalog
    $scope.catalog = {};
    $scope.catalogList = [];
    $scope.rayons = [];
    $scope.selectedIng = null;
    $scope.ingSearch = '';

    $http.get('/recettes.json').then(function(r) { $scope.recettes = r.data.recettes || []; });
    $http.get('/matin.json').then(function(r) { $scope.recettes_matin = r.data.recettes || []; });
    $http.get('/ingredients').then(function(r) { $scope.ingredientNames = Object.keys(r.data).sort(); });
    $http.get('/rayons').then(function(r) { $scope.rayons = r.data; });
    $http.get('/ingredients/raw').then(function(r) { $scope.catalog = r.data; buildCatalogList(); });

    function buildCatalogList() {
        $scope.catalogList = Object.keys($scope.catalog).sort(function(a, b) {
            return a.localeCompare(b, 'fr', {sensitivity: 'base'});
        }).map(function(n) {
            return {name: n, rayon: $scope.catalog[n].rayon || '', unit: $scope.catalog[n].unit || ''};
        });
    }

    $scope.currentList = function() {
        return $scope.tabIndex === 0 ? $scope.recettes : $scope.recettes_matin;
    };

    $scope.switchTab = function(idx) {
        $scope.tabIndex = idx;
        $scope.selected = null;
        $scope.selectedIng = null;
        if (idx < 2) {
            $http.get('/recettes.json').then(function(r) { $scope.recettes = r.data.recettes || []; });
            $http.get('/matin.json').then(function(r) { $scope.recettes_matin = r.data.recettes || []; });
        }
    };

    $scope.selectRecette = function(r) {
        var clone = JSON.parse(JSON.stringify(r));
        clone._isNew = false;
        clone._originalName = r.name;
        clone.ingredients.forEach(function(ing) {
            if (ing.qty === undefined || ing.qty === null) ing.qty = '';
        });
        $scope.selected = clone;
    };

    $scope.newRecette = function() {
        $scope.selected = {
            name: '',
            ingredients: [{name: '', qty: ''}],
            _isNew: true,
            _originalName: null
        };
    };

    $scope.cancelEdit = function() { $scope.selected = null; };

    $scope.addIngredient = function() {
        $scope.selected.ingredients.push({name: '', qty: ''});
    };

    $scope.removeIngredient = function(idx) {
        $scope.selected.ingredients.splice(idx, 1);
    };

    $scope.deleteRecette = function() {
        var list = $scope.currentList();
        var originalName = $scope.selected._originalName;
        $mdDialog.show(
            $mdDialog.confirm()
                .title('Supprimer la recette ?')
                .textContent('"' + originalName + '"')
                .ok('Supprimer')
                .cancel('Annuler')
        ).then(function() {
            var idx = findIdx(list, originalName);
            if (idx >= 0) list.splice(idx, 1);
            $scope.selected = null;
            postList(list, angular.noop);
        });
    };

    $scope.save = function() {
        var name = ($scope.selected.name || '').trim();
        if (!name) { toast('Le nom est requis.'); return; }

        var ings = $scope.selected.ingredients
            .filter(function(i) { return (i.name || '').trim() !== ''; })
            .map(function(i) {
                var out = {name: i.name.trim()};
                var q = parseFloat(i.qty);
                if (!isNaN(q) && i.qty !== '' && i.qty !== null) out.qty = q;
                return out;
            });

        if (!ings.length) { toast('Ajoutez au moins un ingrédient.'); return; }

        var list = $scope.currentList();

        if (name !== $scope.selected._originalName && findIdx(list, name) >= 0) {
            toast('Une recette avec ce nom existe déjà.');
            return;
        }

        var recipe = {name: name, ingredients: ings};
        var idx = findIdx(list, $scope.selected._originalName);
        if ($scope.selected._isNew || idx < 0) {
            list.push(recipe);
        } else {
            list[idx] = recipe;
        }

        postList(list, function() {
            $scope.selected._isNew = false;
            $scope.selected._originalName = name;
            $scope.selected.name = name;
            $scope.selected.ingredients = ings.map(function(i) {
                return {name: i.name, qty: i.qty !== undefined ? i.qty : ''};
            });
        });
    };

    function findIdx(list, name) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].name === name) return i;
        }
        return -1;
    }

    function postList(list, onSuccess) {
        var isMain = $scope.tabIndex === 0;
        var url = isMain ? '/recettes/save' : '/matin/save';
        $http.post(url, {recettes: list}).then(
            function() { toast('Enregistré !'); onSuccess(); },
            function(resp) {
                toast('Erreur: ' + (resp.data || resp.statusText || 'inconnu'));
                if (isMain) {
                    $http.get('/recettes.json').then(function(r) { $scope.recettes = r.data.recettes || []; });
                } else {
                    $http.get('/matin.json').then(function(r) { $scope.recettes_matin = r.data.recettes || []; });
                }
            }
        );
    }

    // ── Ingredient catalog ────────────────────────────────────────────────────

    $scope.selectIng = function(ing) {
        $scope.selectedIng = {
            name: ing.name, rayon: ing.rayon, unit: ing.unit,
            _originalName: ing.name, _isNew: false
        };
    };

    $scope.newIng = function() {
        $scope.selectedIng = {
            name: '', rayon: $scope.rayons[0] || '', unit: '',
            _originalName: null, _isNew: true
        };
    };

    $scope.cancelIngEdit = function() { $scope.selectedIng = null; };

    $scope.addRayon = function() {
        $mdDialog.show(
            $mdDialog.prompt()
                .title('Nouveau rayon')
                .placeholder('Nom du rayon')
                .ok('Ajouter')
                .cancel('Annuler')
        ).then(function(name) {
            name = (name || '').trim();
            if (!name) return;
            if ($scope.rayons.indexOf(name) >= 0) { toast('Ce rayon existe déjà.'); return; }
            $scope.rayons.push(name);
            if ($scope.selectedIng) $scope.selectedIng.rayon = name;
            $http.post('/rayons/save', $scope.rayons).then(
                angular.noop,
                function(resp) {
                    toast('Erreur: ' + (resp.data || resp.statusText || 'inconnu'));
                    $scope.rayons.pop();
                }
            );
        });
    };

    $scope.deleteIng = function() {
        $mdDialog.show(
            $mdDialog.confirm()
                .title('Supprimer l\'ingrédient ?')
                .textContent('"' + $scope.selectedIng._originalName + '"')
                .ok('Supprimer')
                .cancel('Annuler')
        ).then(function() {
            delete $scope.catalog[$scope.selectedIng._originalName];
            $scope.selectedIng = null;
            buildCatalogList();
            postCatalog(angular.noop);
        });
    };

    $scope.saveIng = function() {
        var oldName = $scope.selectedIng._originalName;
        var name = ($scope.selectedIng.name || '').trim();
        if (!name) { toast('Le nom est requis.'); return; }
        if (!$scope.selectedIng.rayon) { toast('Le rayon est requis.'); return; }
        if (name !== oldName && $scope.catalog[name]) {
            toast('Un ingrédient avec ce nom existe déjà.');
            return;
        }
        if (oldName && name !== oldName) {
            delete $scope.catalog[oldName];
        }
        var entry = {rayon: $scope.selectedIng.rayon};
        var unit = ($scope.selectedIng.unit || '').trim();
        if (unit) entry.unit = unit;
        $scope.catalog[name] = entry;
        buildCatalogList();
        postCatalog(function() {
            if (oldName && name !== oldName) renameInRecipes(oldName, name);
            $scope.selectedIng._originalName = name;
            $scope.selectedIng._isNew = false;
            $scope.selectedIng.name = name;
        });
    };

    function renameInRecipes(oldName, newName) {
        var dirty = [false, false];
        [$scope.recettes, $scope.recettes_matin].forEach(function(list, i) {
            list.forEach(function(r) {
                r.ingredients.forEach(function(ing) {
                    if (ing.name === oldName) { ing.name = newName; dirty[i] = true; }
                });
            });
        });
        if (dirty[0]) $http.post('/recettes/save', {recettes: $scope.recettes});
        if (dirty[1]) $http.post('/matin/save', {recettes: $scope.recettes_matin});
    }

    function postCatalog(onSuccess) {
        $http.post('/ingredients/save', $scope.catalog).then(
            function() {
                toast('Enregistré !');
                $scope.ingredientNames = Object.keys($scope.catalog).sort(function(a, b) {
                    return a.localeCompare(b, 'fr', {sensitivity: 'base'});
                });
                onSuccess();
            },
            function(resp) {
                toast('Erreur: ' + (resp.data || resp.statusText || 'inconnu'));
                $http.get('/ingredients/raw').then(function(r) { $scope.catalog = r.data; buildCatalogList(); });
            }
        );
    }

    function toast(msg) {
        $mdToast.show($mdToast.simple().textContent(msg).position('top right').hideDelay(3000));
    }
});
