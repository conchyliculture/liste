var ListeHelpers = (function () {
    "use strict";

    function range(max) {
        var res = [];
        for (var i = 1; i <= max; i++) { res.push(i); }
        return res;
    }

    function arrondi(nb, unit) {
        if (typeof nb === "undefined" || nb === null) {
            return (unit === null || typeof unit === "undefined") ? "" : unit;
        }
        if (typeof unit === "undefined" || unit === null) {
            return Math.round(nb);
        }
        var n = 0;
        switch (unit) {
            case "g":
                if (nb >= 1000) {
                    n = Math.round(nb / 100) / 10;
                    return n + "kg";
                }
                break;
            case "cL":
                if (nb >= 100) {
                    n = Math.round(nb / 10) / 10;
                    return n + "L";
                }
                break;
            case "L":
                return Math.round(nb) + " L";
            case "":
                return Math.round(nb) + "";
        }
        var sep = (unit === "g" || unit === "cL") ? "" : " ";
        var u   = unit.trim();
        return (nb > 10 ? Math.round(nb) : nb) + sep + u;
    }

    function addToListe(liste_json, ingredient, nb_gens) {
        for (var i = 0; i < liste_json.length; i++) {
            var item = liste_json[i];
            if (item.name === ingredient.name) {
                if ("qty" in ingredient) {
                    item.qty = item.qty + ingredient.qty * nb_gens;
                }
                return;
            }
        }
        var clone = JSON.parse(JSON.stringify(ingredient));
        if ("qty" in ingredient) {
            clone.qty = ingredient.qty * nb_gens;
        }
        liste_json.push(clone);
    }

    return {range: range, arrondi: arrondi, addToListe: addToListe};
})();
