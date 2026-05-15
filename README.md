# Liste

## Start

### The easy way

```
# apt-get install ruby-sinatra ruby-sqlite3 puma
$ ruby liste.rb
```

Point your browser to [http://localhost:4567](http://localhost:4567)

### With bundler

```
bundle install
bundle exec rackup
```

Point your browser to [http://localhost:9292](http://localhost:9292)

### Docker

```
docker build -t liste .
docker run -d --name liste -p 4567:4567 liste
```

### Configuration

| Environment variable | Default | Description |
|---|---|---|
| `DB_PATH` | `liste.db` | Path to the SQLite database |
| `EVENTS_TIMEOUT` | `20` | Long-poll timeout in seconds |

## Features

- Plan meals for the week (lunch/dinner/breakfast, per-person quantities)
- Shopping list generated automatically, sorted by supermarket aisle
- Adjust quantities and add custom items before shopping
- Save and reload lists
- **Shopping mode**: share a session URL with others — everyone sees real-time updates as items get checked off

## Shopping mode

Click **Faire les courses** from the main page or the load dialog to create a session. Share the URL with other shoppers. Each person picks a nickname and can check items off, add items, or delete items. The list updates live across all connected devices via long-polling.

## Update recettes

1. Breakfast meals go in `public/matin.json`, everything else in `public/recettes.json`.

2. Add your recette as a JSON object:

```json
{   "name": "Sandwich au caca",
    "ingredients": [
        {"name":"Pain", "qty": 1},
        {"name":"Caca", "qty": 80}
    ]
}
```

`qty` is the amount per person per meal. Units are defined separately in `public/ingredients.json`.

3. Make sure all ingredients exist in `public/ingredients.json`, adding any new ones:

```json
  "Caca": {
    "rayon": "Charcuterie",
    "unit": "g"
  }
```

## Tests

```
# apt-get install ruby-rack-test
$ ruby tests/tests.rb
```

## Dev

WARNING all the crap is mostly in
`public/js/liste.js` and is disgusting AngluarJS shit copy pasted from StackOverflow and inserted into the code with a sledgehammer.

The backend is `liste.rb` (Sinatra): saves/loads lists (SQLite), serves the main page, handles shopping sessions.

The frontend is `public/js/liste.js` (AngularJS): `ListeCtrl` for the main page, `LoadCtrl` for the load dialog, `ShoppingCtrl` for the shopping session dialog.

Shopping mode UI is a separate self-contained page (`views/shop.erb`) with vanilla JS and long-polling.
