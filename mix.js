/* Mixmaster's recommendation engine: which recipes your bar can make, and which ones use up what most needs using.
   Plain JavaScript with no dependencies, loaded by index.html as a script (window.Mix) and by the tests with require().
   README, "How recommendations work", explains the heuristics in words. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mix = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY = 86400000;
  // Lowercase without accents, so "benedictine" finds Bénédictine and "creme" finds crème
  const fold = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // How much a missing ingredient of each kind counts against a recipe, and how much it weighs in coverage.
  // Spirits make the drink; a lime is a five-minute errand.
  const WEIGHT = { spirit: 1, liqueur: 0.9, 'fortified-wine': 0.8, wine: 0.6, bitters: 0.5, syrup: 0.35, juice: 0.25, fresh: 0.2, mixer: 0.2, pantry: 0.15 };
  // Credit a line gets for each way of covering it
  const CREDIT = { have: 1, close: 0.85, loose: 0.6, staple: 0.9, missing: 0 };

  // How much one line counts as pouring, relative to a 30 ml measure
  function pour(line) {
    switch (line.unit) {
      // Square root, so a 7.5 ml pour of a specialty liqueur still counts for half a measure: those bottles are
      // only ever used a little at a time, and finishing them is the whole point
      case 'ml': return Math.min(1.25, Math.max(0.3, Math.sqrt(line.amount / 30)));
      case 'barspoon': return 0.15;
      case 'dash': case 'drop': return Math.min(0.5, 0.05 * line.amount);
      case 'rinse': return 0.1;
      case 'top': return 1;
      default: return 0.2;
    }
  }

  /* Builds the lookups the rest needs from the data files: ingredients by id, members of each family,
     and how many recipes use each ingredient (rare ones are harder to use up). */
  function catalog(ingredients, recipes) {
    const ing = new Map(ingredients.map(i => [i.id, i]));
    const family = new Map();
    ingredients.forEach(i => { if (i.family) { if (!family.has(i.family)) family.set(i.family, []); family.get(i.family).push(i.id); } });
    const uses = new Map(ingredients.map(i => [i.id, 0]));
    recipes.forEach(r => new Set(r.ingredients.filter(l => !l.garnish).map(l => l.ingredient)).forEach(id => uses.set(id, (uses.get(id) || 0) + 1)));
    const words = new Map(ingredients.map(i => [i.id, fold([i.name, ...(i.aliases || []), i.family || ''].join(' '))]));
    return { ing, family, uses, words, recipes, byId: new Map(recipes.map(r => [r.id, r])) };
  }

  function inStock(b) { return b && b.ingredient && !(b.level <= 0); }

  /* How much a bottle wants using, with the reasons in words. 0 is "no hurry"; above 1 is "use it soon".
     Savoured bottles come back flagged instead, and every recipe that would pour one is halved. */
  function urgency(cat, b, now) {
    const i = cat.ing.get(b.ingredient) || {};
    const why = [];
    let u = 0;
    const age = b.openedAt ? Math.max(0, (now - Date.parse(b.openedAt)) / DAY) : null;
    if (age != null && i.shelfLifeDays) {
      const r = age / i.shelfLifeDays;
      if (r >= 0.5) {
        u += Math.min(2, (r - 0.5) * 2);
        why.push(r >= 1 ? `opened ${span(age)} ago, past its best (${span(i.shelfLifeDays)})` : `opened ${span(age)} ago, best within ${span(i.shelfLifeDays)}`);
      }
    } else if (age != null && age > 180) {
      u += 0.3; why.push(`open for ${span(age)}`);
    }
    if (i.specialty) { u += 0.6; why.push('a specialty bottle'); }
    const n = cat.uses.get(b.ingredient) || 0;
    if (n > 0 && n <= 3) { u += 0.4; why.push(n === 1 ? 'only one recipe here uses it' : `only ${n} recipes here use it`); }
    if (b.level != null && b.level <= 0.25) { u += 0.5; why.push('nearly finished'); }
    if (b.mood === 'use-up') { u += 1.2; why.push('you want it gone'); }
    if (b.mood === 'savour') return { value: 0, why: ['you’re saving it'], savour: true };
    return { value: u, why };
  }

  function span(days) {
    if (days < 1.5) return 'a day';
    if (days < 14) return `${Math.round(days)} days`;
    if (days < 60) return `${Math.round(days / 7)} weeks`;
    if (days < 540) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  }

  /* Indexes a bar (list of bottles) by ingredient, most urgent bottle first, so the engine always pours from
     the bottle that most needs finishing. */
  function stock(cat, bar, now) {
    const by = new Map();
    for (const b of bar) {
      if (!inStock(b)) continue;
      const e = { bottle: b, urgency: urgency(cat, b, now) };
      if (!by.has(b.ingredient)) by.set(b.ingredient, []);
      by.get(b.ingredient).push(e);
    }
    by.forEach(list => list.sort((a, b) => b.urgency.value - a.urgency.value));
    return by;
  }

  // How one recipe line is covered: the bottle itself, a close substitute, a stand-in from the same family, or nothing
  function cover(cat, st, line, assumeStaples) {
    const id = line.ingredient, i = cat.ing.get(id) || {};
    if (st.has(id)) return { status: 'have', use: st.get(id)[0] };
    const pick = ids => ids.filter(x => x !== id && st.has(x)).map(x => st.get(x)[0]).sort((a, b) => b.urgency.value - a.urgency.value)[0];
    const close = pick(i.substitutes || []);
    if (close) return { status: 'close', use: close };
    const loose = i.family ? pick(cat.family.get(i.family) || []) : null;
    if (loose) return { status: 'loose', use: loose };
    if (i.staple && assumeStaples) return { status: 'staple' };
    return { status: 'missing' };
  }

  /* Scores one recipe against the bar.
     coverage  0..1, weighted by how hard each ingredient is to get
     bonus     how much it uses up bottles that want using (sum of urgency × how much it pours)
     score     coverage³ × (1 + bonus) × variety × ½ per savoured bottle it pours;
               cubing coverage keeps "can make now" well above "nearly" */
  function assess(cat, st, r, o) {
    let have = 0, total = 0, bonus = 0, saving = 0;
    const lines = [], missing = [], grab = [], usesUp = [];
    let makeable = true, stretch = false;
    for (const line of r.ingredients) {
      if (line.garnish) {
        lines.push({ line, status: st.has(line.ingredient) ? 'have' : 'garnish' });
        continue;
      }
      const i = cat.ing.get(line.ingredient) || {};
      const c = cover(cat, st, line, o.assumeStaples);
      lines.push({ line, status: c.status, bottle: c.use && c.use.bottle });
      if (line.optional) continue;
      const w = WEIGHT[i.category] || 0.5;
      total += w; have += w * CREDIT[c.status];
      if (c.status === 'missing') { makeable = false; missing.push(line.ingredient); }
      if (c.status === 'staple') grab.push(line.ingredient);
      if (c.status === 'loose') stretch = true;
      if (c.use && c.use.urgency.savour) saving++;
      if (c.use && c.use.urgency.value) {
        const gain = c.use.urgency.value * pour(line) * (c.status === 'have' ? 1 : 0.7);
        bonus += gain;
        if (gain > 0.05) usesUp.push({ bottle: c.use.bottle, gain, why: c.use.urgency.why });
      }
    }
    const coverage = total ? have / total : 0;
    let variety = 1;
    const last = o.lastMade && o.lastMade.get(r.id);
    if (last != null) { const d = (o.now - last) / DAY; variety = d < 3 ? 0.7 : d < 14 ? 0.9 : 1; }
    const fav = o.favourites && o.favourites.has(r.id) ? 1.1 : 1;
    const score = Math.pow(coverage, 3) * (1 + bonus) * variety * fav * Math.pow(0.5, saving);
    usesUp.sort((a, b) => b.gain - a.gain);
    return { recipe: r, score, coverage, bonus, saving, makeable, stretch, lines, missing, grab, usesUp };
  }

  /* Text search over names, tags, origin and ingredients (names, aliases and families). Every word has to match
     something; matches in the name count most. Returns Map(recipe id → text score); an empty query returns null. */
  function search(cat, query) {
    const words = fold(query).split(/[\s,]+/).filter(Boolean);
    if (!words.length) return null;
    const out = new Map();
    for (const r of cat.recipes) {
      const name = fold(r.name), tags = r.tags.join(' ').replace(/-/g, ' '), origin = fold(r.origin);
      const ings = r.ingredients.map(l => cat.words.get(l.ingredient) || l.ingredient);
      let s = 0, ok = true;
      for (const w of words) {
        let best = 0;
        if (name.split(/\s+/).some(x => x.startsWith(w))) best = 4;
        else if (name.includes(w)) best = 3;
        if (tags.includes(w)) best = Math.max(best, 2);
        if (ings.some(x => x.includes(w))) best = Math.max(best, 2);
        if (origin.includes(w)) best = Math.max(best, 1);
        if (!best) { ok = false; break; }
        s += best;
      }
      if (ok) out.set(r.id, s);
    }
    return out;
  }

  /* Ranks every recipe (or those matching the query) for the bar.
     o: { now, assumeStaples (default true), lastMade: Map(id → time), favourites: Set(id), query } */
  function rank(cat, bar, o = {}) {
    o = { now: Date.now(), assumeStaples: true, ...o };
    const st = stock(cat, bar, o.now);
    const hits = search(cat, o.query);
    const list = [];
    for (const r of cat.recipes) {
      if (hits && !hits.has(r.id)) continue;
      const a = assess(cat, st, r, o);
      if (hits) a.score *= 1 + 0.05 * hits.get(r.id);
      list.push(a);
    }
    return list.sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name));
  }

  /* The bottles worth buying next: for each missing ingredient, the recipes it alone stands between you and,
     weighted by how much those recipes would use up. Takes the output of rank(). */
  function unlocks(cat, ranked, max = 5) {
    const by = new Map();
    for (const a of ranked) {
      if (a.missing.length !== 1) continue;
      const id = a.missing[0];
      if (!by.has(id)) by.set(id, { ingredient: id, recipes: [], gain: 0 });
      const e = by.get(id); e.recipes.push(a.recipe.id); e.gain += 1 + Math.max(0, a.bonus);
    }
    return [...by.values()].sort((a, b) => b.gain - a.gain).slice(0, max);
  }

  /* One-line reasons for a recommendation, most useful first */
  function reasons(cat, a) {
    const out = [];
    for (const u of a.usesUp.slice(0, 2)) {
      const i = cat.ing.get(u.bottle.ingredient);
      const name = u.bottle.label || (i && i.name) || u.bottle.ingredient;
      out.push(`Uses your ${name}${u.why.length ? ': ' + u.why.join(', ') : ''}`);
    }
    const subs = a.lines.filter(l => l.status === 'close' || l.status === 'loose');
    for (const l of subs) {
      const want = cat.ing.get(l.line.ingredient), got = cat.ing.get(l.bottle.ingredient);
      out.push(`${got ? got.name : l.bottle.ingredient} for ${want ? want.name : l.line.ingredient}${l.status === 'loose' ? ' (a stretch)' : ''}`);
    }
    if (a.missing.length) out.push('Missing ' + a.missing.map(id => (cat.ing.get(id) || {}).name || id).join(', '));
    if (a.grab.length) out.push('Grab ' + a.grab.map(id => ((cat.ing.get(id) || {}).name || id).toLowerCase()).join(', '));
    return out;
  }

  return { fold, catalog, urgency, stock, rank, search, unlocks, reasons, pour, WEIGHT, CREDIT };
});
