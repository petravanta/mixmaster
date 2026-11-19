# Notes for coding agents

Follow the shared standards in [petravanta/general STANDARDS.md](https://github.com/petravanta/general/blob/main/STANDARDS.md)
(locally `../general/STANDARDS.md`). Only Mixmaster specifics are here.

- **One static page**, `index.html`, no build step. Serve the folder (`python3 -m http.server`) to run it. The shared theme,
  `google-token.js` and `drive-store.js` are inlined between their marker comments; when the canonical copies in
  `general/shared/` change, update them here.
- **Accent**: chartreuse, `#5d7a0f` light / `#b8d957` dark.
- **The engine is `mix.js`**, plain JavaScript loaded by the page (`window.Mix`) and by the tests (`require`). All ranking
  logic lives there, none in `index.html`. Run `node --test scripts/*.test.js` after changing it, and keep the README's
  *How recommendations work* and the Settings drawer's explanation in step with it.
- **Built-in knowledge** is in `data/`: `ingredients.json` and `glasses.json` are lists; recipes are a folder dataset,
  one file per recipe in `data/recipes/<id>.json`, with `data/recipes.json` listing the ids in display order. Schemas
  are in `data/schema/` (`recipe.schema.json` covers each recipe file). Run `node scripts/check-data.js` after changing
  data. Ids are never renamed or reused: bars and history refer to them.
- **User data**: `localStorage` key `mixmaster.data`; Drive file `petravanta/Mixmaster/Mixmaster data.json` (app id `mixmaster`, key prefix
  `mixmaster.drive`). Version 1, lists `bottles` (`{ id, u, ingredient, label?, openedAt?, level?, mood? }`, `mood` is
  `use-up` or `savour`), `made` (`{ id, u, recipe, at }`) and `favourites` (`{ id: 'fav-<recipe>', u, recipe, on }`);
  settings `units` (`ml` / `oz`) and `assumeStaples`. `upgrade()` is the only way outside data becomes a document;
  merge rules are `mergeDocs()`. A finished bottle is deleted (tombstoned), not kept at level 0.
- Contributions from other people come in as pull requests to `data/` (CONTRIBUTING.md) or the *Suggest a recipe* issue
  form (`.github/ISSUE_TEMPLATE/recipe.yml`). Those PRs wait for review; they are not auto-merged.
