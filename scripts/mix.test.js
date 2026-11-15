// Tests for the recommendation engine (mix.js) against the real catalog. Run: node --test scripts/*.test.js
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const Mix = require('../mix.js');
const D = path.join(__dirname, '..', 'data');
const read = f => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const recipes = read('recipes.json').map(id => read(`recipes/${id}.json`));
const cat = Mix.catalog(read('ingredients.json'), recipes);
const NOW = Date.parse('2026-11-15T12:00:00Z');
const ago = d => new Date(NOW - d * 86400000).toISOString();
const bar = (...ids) => ids.map((x, n) => typeof x === 'string' ? { id: 'b' + n, ingredient: x } : { id: 'b' + n, ...x });
const top = (b, o = {}) => Mix.rank(cat, b, { now: NOW, ...o });
const find = (list, id) => list.find(a => a.recipe.id === id);

test('a full bar for a recipe makes it makeable with full coverage', () => {
  const a = find(top(bar('london-dry-gin', 'campari', 'sweet-vermouth')), 'negroni');
  assert.equal(a.makeable, true);
  assert.equal(a.coverage, 1);
});

test('makeable recipes rank above ones missing a spirit', () => {
  const list = top(bar('london-dry-gin', 'campari', 'sweet-vermouth'));
  const negroni = list.findIndex(a => a.recipe.id === 'negroni');
  const boulevardier = list.findIndex(a => a.recipe.id === 'boulevardier');
  assert.ok(negroni < boulevardier);
});

test('staples are assumed unless turned off', () => {
  assert.equal(find(top(bar('white-rum')), 'daiquiri').makeable, true);
  assert.deepEqual(find(top(bar('white-rum')), 'daiquiri').grab, ['lime-juice', 'simple-syrup']);
  assert.equal(find(top(bar('white-rum'), { assumeStaples: false }), 'daiquiri').makeable, false);
});

test('a close substitute covers a line, a family stand-in is a stretch', () => {
  const rye = find(top(bar('rye-whiskey', 'campari', 'sweet-vermouth')), 'boulevardier');
  assert.equal(rye.makeable, true); assert.equal(rye.stretch, false);
  assert.equal(rye.lines[0].status, 'close');
  const irish = find(top(bar('irish-whiskey', 'campari', 'sweet-vermouth')), 'boulevardier');
  assert.equal(irish.lines[0].status, 'loose'); assert.equal(irish.stretch, true);
  assert.ok(irish.coverage < rye.coverage);
});

test('an old opened vermouth pushes vermouth drinks up', () => {
  const base = ['london-dry-gin', 'campari', 'fino-sherry', 'angostura', 'orange-bitters'];
  const fresh = top(bar(...base, { ingredient: 'dry-vermouth', openedAt: ago(2) }, { ingredient: 'sweet-vermouth', openedAt: ago(2) }));
  const old = top(bar(...base, { ingredient: 'dry-vermouth', openedAt: ago(50) }, { ingredient: 'sweet-vermouth', openedAt: ago(2) }));
  assert.ok(find(old, 'bamboo').score > find(fresh, 'bamboo').score);
  assert.ok(old.findIndex(a => a.recipe.id === 'bamboo') < old.findIndex(a => a.recipe.id === 'adonis'));
  assert.match(Mix.reasons(cat, find(old, 'bamboo'))[0], /Dry vermouth: opened 7 weeks ago, past its best/);
});

test('use-up and specialty bottles beat plain ones, savoured bottles sink', () => {
  const b = bar('london-dry-gin', 'lime-juice', 'green-chartreuse', 'maraschino', 'campari', 'sweet-vermouth');
  const plain = top(b);
  assert.ok(find(plain, 'last-word').score > find(plain, 'negroni').score, 'specialty bottles count');
  const saving = top(b.map(x => x.ingredient === 'green-chartreuse' ? { ...x, mood: 'savour' } : x));
  assert.ok(find(saving, 'last-word').score < find(saving, 'negroni').score, 'savoured chartreuse sinks the Last Word');
  const goAway = top(b.map(x => x.ingredient === 'campari' ? { ...x, mood: 'use-up' } : x));
  assert.ok(find(goAway, 'negroni').score > find(plain, 'negroni').score);
});

test('the most urgent bottle of an ingredient is the one poured', () => {
  const a = find(top(bar('london-dry-gin', 'campari', { id: 'new', ingredient: 'sweet-vermouth', openedAt: ago(1) }, { id: 'old', ingredient: 'sweet-vermouth', openedAt: ago(40) })), 'negroni');
  assert.equal(a.lines[2].bottle.id, 'old');
});

test('empty bottles are not in stock', () => {
  assert.equal(find(top(bar('london-dry-gin', 'campari', { ingredient: 'sweet-vermouth', level: 0 })), 'negroni').makeable, false);
});

test('recently made drinks drop a little for variety', () => {
  const b = bar('london-dry-gin', 'campari', 'sweet-vermouth');
  const again = find(top(b, { lastMade: new Map([['negroni', NOW - 86400000]]) }), 'negroni');
  assert.ok(again.score < find(top(b), 'negroni').score);
});

test('search matches names, ingredients, aliases and tags, every word', () => {
  const ids = q => [...Mix.search(cat, q).keys()];
  assert.ok(ids('negr').includes('negroni'));
  assert.ok(ids('triple sec').includes('margarita'));
  assert.ok(ids('tiki').includes('mai-tai'));
  assert.ok(ids('chartreuse mezcal').includes('naked-and-famous'));
  assert.ok(!ids('chartreuse mezcal').includes('last-word'));
  assert.equal(Mix.search(cat, '  '), null);
});

test('unlocks names the one bottle that opens the most drinks', () => {
  const ranked = top(bar('london-dry-gin', 'rye-whiskey', 'sweet-vermouth', 'angostura'));
  const u = Mix.unlocks(cat, ranked);
  assert.equal(u[0].ingredient, 'campari');
  assert.ok(u[0].recipes.includes('negroni'));
});
