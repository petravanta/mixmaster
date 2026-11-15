#!/usr/bin/env node
// Checks what the JSON Schemas can't: unique ids, that every recipe in data/recipes/ is listed in data/recipes.json
// (and the other way round), and that recipes only use ingredients and glasses that exist.
// The schemas themselves are checked by ajv-cli in .github/workflows/check-data.yml. Run: node scripts/check-data.js
'use strict';
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const errors = [];
const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch (e) { errors.push(`${file}: ${e.message}`); return fallback; }
};
const ingredients = read('ingredients.json', []), glasses = read('glasses.json', []), list = read('recipes.json', []);

for (const [file, rows] of [['ingredients.json', ingredients], ['glasses.json', glasses]]) {
  const seen = new Set();
  rows.forEach((r, i) => { if (seen.has(r.id)) errors.push(`${file}[${i}]: id "${r.id}" is used twice`); seen.add(r.id); });
}
const ing = new Map(ingredients.map(i => [i.id, i])), glass = new Set(glasses.map(g => g.id));

// Substitutes point at real ingredients, never at themselves; an alias belongs to only one ingredient
const alias = new Map();
ingredients.forEach(i => {
  (i.substitutes || []).forEach(s => {
    if (s === i.id) errors.push(`ingredients.json: "${i.id}" lists itself as a substitute`);
    else if (!ing.has(s)) errors.push(`ingredients.json: "${i.id}" lists substitute "${s}", which isn't an ingredient`);
  });
  [i.name.toLowerCase(), ...(i.aliases || [])].forEach(a => {
    if (alias.has(a) && alias.get(a) !== i.id) errors.push(`ingredients.json: "${i.id}" uses the name or alias "${a}", which already belongs to "${alias.get(a)}"`);
    alias.set(a, i.id);
  });
});

// The recipe list and the folder agree
const files = fs.readdirSync(path.join(DATA, 'recipes')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
const listed = new Set();
list.forEach(id => { if (listed.has(id)) errors.push(`recipes.json: "${id}" is listed twice`); listed.add(id); });
files.filter(id => !listed.has(id)).forEach(id => errors.push(`recipes/${id}.json isn't listed in recipes.json`));
list.filter(id => !files.includes(id)).forEach(id => errors.push(`recipes.json lists "${id}", but there is no recipes/${id}.json`));

const names = new Map();
for (const id of files) {
  const r = read(`recipes/${id}.json`, null); if (!r) continue;
  const at = `recipes/${id}.json`;
  if (r.id !== id) errors.push(`${at}: its id is "${r.id}", but the file name says "${id}"`);
  if (r.format || r.formatVersion) errors.push(`${at}: remove "format" and "formatVersion"; they only belong on a recipe shared from the app`);
  if (!glass.has(r.glass)) errors.push(`${at}: glass "${r.glass}" isn't in glasses.json`);
  const key = String(r.name).toLowerCase();
  if (names.has(key)) errors.push(`${at}: "${r.name}" has the same name as recipes/${names.get(key)}.json`);
  names.set(key, id);
  const used = new Set();
  (r.ingredients || []).forEach((l, n) => {
    if (!ing.has(l.ingredient)) errors.push(`${at}: ingredient ${n + 1}, "${l.ingredient}", isn't in ingredients.json`);
    if (used.has(l.ingredient) && !l.garnish) errors.push(`${at}: "${l.ingredient}" is listed twice`);
    used.add(l.ingredient);
  });
  if (!(r.ingredients || []).some(l => !l.garnish && !l.optional)) errors.push(`${at}: needs at least one ingredient that isn't optional or a garnish`);
}

if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
console.log(`✓ ${ingredients.length} ingredients, ${glasses.length} glasses, ${files.length} recipes`);
