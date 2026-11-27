# Adding to Mixmaster's catalog

You don't need to be a programmer to add a cocktail or an ingredient. Everything the app knows lives in plain text
files in the `data/` folder. If you'd rather not touch files at all, use the
[*Suggest a recipe* form](https://github.com/petravanta/mixmaster/issues/new?template=recipe.yml).

## Add a recipe

1. Copy a recipe file in `data/recipes/` that's close to yours, for example `data/recipes/last-word.json`, and name the
   copy after your drink's id: `data/recipes/my-drink.json`.
2. Change the copy:
   - `id`: the file name without `.json`, in lowercase letters, digits and hyphens. It must be new, and never changes
     once published, because people's history refers to it.
   - `name`: what the app shows.
   - `ingredients`: one entry per line of the recipe. `ingredient` is an id from `data/ingredients.json`. Use `ml` for
     measured liquids (22.5 ml is ¾ oz, 30 ml is 1 oz), `dash` or `drop` for bitters, `rinse` for coating the glass and
     `top` for filling up. Add `"garnish": true` or `"optional": true` where it fits.
   - `method`, `glass`, `steps`, `tags`: copy from a similar drink. The schema lists the allowed values.
   - `color`, `float` and `ice` are optional and draw the drink's picture: its colour as `#rrggbb` (or two, bottom
     first, for a drink that grades), a layer on top (foam, cream), and `cubes`, `large` or `crushed` ice.
   - `origin` and `why` are optional: where it comes from, and what makes it work.
   - `contributor` is optional: your GitHub name, to credit you.
3. Add the id to `data/recipes.json`, where you want it to appear in the list.
4. Mind the commas: every entry except the last is followed by a comma.
5. Open a pull request. The *Check data* check tells you if anything is off, and says what.

## Add an ingredient

Copy an entry in `data/ingredients.json` and change it. A few fields matter for recommendations:

- `category`: how much missing it counts against a drink (a spirit a lot, a juice a little).
- `substitutes`: ids that work well in its place. One-way, so list it on both if it works both ways.
- `family`: a loose group (whiskey, rum, amaro). Anything in the same family is offered as a stretch.
- `shelfLifeDays`: about how long it stays good once opened. Opened bottles near the end are pushed up.
- `specialty`: `true` for bottles people buy for one drink and struggle to finish.
- `staple`: `true` for things most people have or can grab on the way home.
- `aliases`: other names people search by, in lowercase.

## Something the app has to treat differently

A new kind of entry that changes how the app behaves (a new unit, a new method) needs a code change as well as the
schema. Open an issue describing it instead.

Check your change locally, if you like, with `node scripts/check-data.js`.
