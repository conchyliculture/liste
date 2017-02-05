# Liste
Faisage de liste de courses

```
# apt-get install ruby-sinatra
$ ruby liste.rb
```

Ouvrir [http://localhost:4567](http://localhost:4567)

## Update recettes

1) If it's a breakfast meal, update `public/matin.json`, otherwise it goes into `public/recettes.json`.

2) Add your recette as a JSON object:

```json
{   "name": "Sandwich au caca";
    "ingredients": [
        {"name":"Pain", qty: 1},
        {"name":"Caca", qty: 80}
    ]
}
```

Here the qty is counted as the number needed for 1 person in that meal. You don't have to specify the unit here,
this is taken care of in `public/ingredients.json`.

3) Make sure your ingredients are in the list of valid ingredients. Otherwise, update
`public/ingredients.json`:

```json
  "Caca": {
    "rayon": "Charcuterie",
    "unit": "g"
  }
```

Done!

## Tests

```
# apt-get install ruby-rack-test
$ cd tests; bash run.sh
```

No AngularJS test, because I didn't find a way to do that without having to use
npm to install shitloads of crap. Not gonna do that, no.

## Dev

WARNING all the crap is mostly in
`public/js/liste.js` and is disgusting AngluarJS
shit copy pasted from StackOverflow and inserted into the code with a sledgehammer.

The backend is
`liste.rb`, it mostly handles save and loading of the listes de courses.
It also converts "rayon" into integers, used for sorting the courses.

`liste.js` has 1 main Angular controller `ListeCtrl` for the main page, and a tiny controller
`LoadCtrl` for the load liste popup.
