# Liste

## Start the thing

### If you're a man

```
# apt-get install ruby-sinatra
$ ruby liste.rb
```

Point your browser to [http://localhost:4567](http://localhost:4567)

### If you're a Docker lover

```
docker build -t liste .
docker run -d --name liste -p 4567:4567 liste
```

Point your browser to [http://localhost:4567](http://localhost:4567)

## Update recettes

1) If it's a breakfast meal, update `public/matin.json`, otherwise it goes into `public/recettes.json`.

2) Add your recette as a JSON object:

```json
{   "name": "Sandwich au caca",
    "ingredients": [
        {"name":"Pain", "qty": 1},
        {"name":"Caca", "qty": 80}
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
$ bash tests/run.sh
```

Then point your browser to [http://localhost:4567/jasmine_tests.html](http://localhost:4567/jasmine_tests.html).

## Dev

WARNING all the crap is mostly in
`public/js/liste.js` and is disgusting AngluarJS shit copy pasted from StackOverflow and inserted into the code with a sledgehammer.

The backend is
`liste.rb`, it mostly handles save and loading of the listes de courses.
It also converts "rayon" into integers, used for sorting the courses.

The backend serves the main html page through templating the
`views/main.erb` file.

`liste.js` has 1 main Angular controller `ListeCtrl` for the main page, and a tiny controller
`LoadCtrl` for the load liste popup.
