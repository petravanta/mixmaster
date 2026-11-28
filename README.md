# Mixmaster

**https://petravanta.github.io/mixmaster/**

Cocktails ranked by what's in your bar, with a bias toward the bottles that most need using: the vermouth you opened
two months ago, the crème de violette you bought for one Aviation, the Campari you've decided has to go.

## What works today

- **Tonight**: the drinks you can make now, best first, each with the reasons it ranks where it does
  ("Uses your Dolin dry: opened 7 weeks ago, past its best"). Below that, **One bottle away** (the single purchase that
  unlocks the most) and **Nearly there** (drinks missing one thing).
- **Recipes**: the whole catalog, searchable by drink, bottle, alias or style ("chartreuse mezcal", "triple sec",
  "tiki"), filterable by *Can make*, *One away*, favourites and tags. Each recipe shows what you have, what you can
  substitute and what to grab, in ml or oz.
- **My bar**: add bottles as you type. For each one, optionally note the brand, when you opened it, how much is left, and
  whether to **Use it up** or **Save it**.
- **I made this** logs a drink, so it rests for a few days and others get a turn.
- Your data stays in your browser and, if you like, your own Google Drive. Export and import backups in Settings.
- Installs on a phone, works offline once loaded.

## Drink pictures and shaken or stirred

Each drink shows a small drawing of its glass, filled with its colour. The recipe's `glass`, `color` (one `#rrggbb`, or
two, bottom first, for a gradient), `float` (foam, cream or crema on top), `ice` (`cubes`, `large`, `crushed`) and the
`sparkling` tag decide what's drawn. `Mix.methodHint()` in [`mix.js`](mix.js) says whether it's shaken, stirred or
built, and why, from the method and what goes in: citrus, juice, cream, coffee and egg get shaken, drinks without
them get stirred so they stay clear and silky, and bubbles never go in the shaker.

## How recommendations work

All of it is in [`mix.js`](mix.js), with tests in [`scripts/mix.test.js`](scripts/mix.test.js).

1. **Coverage.** Each ingredient a recipe needs is covered by the bottle itself, a *close substitute* the catalog lists
   (rye for bourbon, 85% credit), a *stand-in from the same family* (Irish for bourbon, 60%, shown as "a stretch") or
   nothing. Lines are weighted by how hard they are to get: a missing spirit counts heavily, a missing lime barely.
   Staples (citrus, simple syrup, soda, egg, mint, peels) count as nearly covered unless you turn that off, and the
   recipe says what to grab. Garnishes and optional lines never count against a drink.
2. **Use-it-up bonus.** Every bottle gets an urgency, with reasons:
   - opened and perishable (`shelfLifeDays` in the catalog): rises from half its shelf life and keeps rising past it;
   - opened for over six months (non-perishables): a little;
   - a **specialty** bottle (bought for one or two drinks): +0.6;
   - **rare in the catalog** (three recipes or fewer use it): +0.4, so niche bottles find their drinks;
   - **nearly finished**: +0.5, to free the shelf;
   - marked **Use it up**: +1.2.
   A recipe's bonus is the sum of the urgency of each bottle it pours, scaled by how much it pours (square root of the
   pour against a 30 ml measure, so a 7.5 ml splash of violette still counts). Where you have two bottles of the same
   thing, it pours from the more urgent one.
3. **Score** = coverage³ × (1 + bonus) × variety × ½ for each **Save it** bottle it would pour. Cubing coverage keeps
   "can make now" well above "nearly". Variety: made in the last 3 days ×0.7, last 2 weeks ×0.9; favourites ×1.1.
4. **One bottle away** counts, for each missing ingredient, the drinks it alone stands between you and, weighted by how
   much those drinks would use up.

## Extending the app

Everything the app knows is data, so adding a cocktail or an ingredient is a pull request to `data/`, no code needed.
[CONTRIBUTING.md](CONTRIBUTING.md) walks through it, and the
[*Suggest a recipe* form](https://github.com/petravanta/mixmaster/issues/new?template=recipe.yml) takes one without git.

| Dataset | File | Schema | What it controls |
| --- | --- | --- | --- |
| Ingredients | `data/ingredients.json` | `data/schema/ingredients.schema.json` | What recipes call for and bars hold: category, substitutes, family, shelf life once opened, specialty, staple, search aliases |
| Glasses | `data/glasses.json` | `data/schema/glasses.schema.json` | Glassware recipes are served in |
| Recipes | `data/recipes/<id>.json`, listed in order in `data/recipes.json` | `data/schema/recipe.schema.json`, `data/schema/recipes.schema.json` | The cocktails: ingredients with amounts, method, glass, steps, tags, origin |

The *Check data* workflow validates every pull request against the schemas, runs `scripts/check-data.js` (ids,
references, the recipe list matching the folder) and the engine tests.

## User data

One JSON document (`localStorage` key `mixmaster.data`, Drive file `petravanta/Mixmaster/Mixmaster data.json`) in the shape the
[shared standards](https://github.com/petravanta/general/blob/main/STANDARDS.md#user-data) describe: `bottles`, `made`
and `favourites` lists of records with `id` and `u`, a `deleted` list, and `settings` with `updatedAt`. Bottles and
history refer to catalog entries by id. AGENTS.md has the field-by-field shape.

## Google Drive sign-in

Uses the shared OAuth client for `petravanta.github.io` and the `drive.file` scope, through the shared
`google-token.js` and `drive-store.js`, loaded by URL from petravanta/general. One sign-in covers all of petravanta's apps.
When Google is busy the app backs off and keeps retrying by itself; the status dot under the header says what came back.

## Next steps

- Your own recipes in the app, with a share export (`format: mixmaster-recipe`) that drops straight into a pull request.
- Bottle sizes, so the app knows when a pour would finish a bottle and can plan a "finish it" session.
- Lowering levels when you log a drink.
- More of the catalog: more modern classics and low-ABV drinks, and more substitutes.
- Its icon glyph in petravanta/general `tools/glyphs/` (the hub card, menu entry and ruleset lists are in).

## Publishing

GitHub Pages serves the `main` branch, root folder. No build step.

## License

MIT, see [LICENSE](LICENSE). The recipes are written for this project; the drinks themselves are classics in the public
domain.
