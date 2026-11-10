import fs from 'node:fs';

const src = fs.readFileSync('.reference/gymmane/lib/catalog/exercise_catalog.dart','utf8');

function listField(block, name) {
  const i = block.indexOf(name + ':');
  if (i < 0) return [];
  const start = block.indexOf('[', i);
  if (start < 0) return [];
  let depth = 0, quote = false, esc = false;
  let end = -1;
  for (let j = start; j < block.length; j++) {
    const c = block[j];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === "'") quote = false;
      continue;
    }
    if (c === "'") quote = true;
    else if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end < 0) return [];
  const bodyText = block.slice(start + 1, end);
  const out = [];
  const re = /'((?:\\.|[^'\\])*)'/g;
  let m;
  while ((m = re.exec(bodyText))) out.push(unescape(m[1]));
  return out;
}
function strField(block, name) {
  const re = new RegExp('\\b' + name + ":\\s*'((?:\\\\.|[^'\\\\])*)'");
  const m = block.match(re);
  return m ? unescape(m[1]) : '';
}
function unescape(s) {
  return s.replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

const parts = src.split(/\n  Exercise\(/).slice(1);
const exercises = [];
for (const raw of parts) {
  const block = raw.split(/\n  \),/)[0];
  const id = strField(block, 'id');
  if (!id) continue;
  exercises.push({
    id,
    name: strField(block, 'name'),
    primary: strField(block, 'primary'),
    secondary: listField(block, 'secondary'),
    equipment: strField(block, 'equipment') || 'Other',
    difficulty: strField(block, 'difficulty') || 'Beginner',
    art: strField(block, 'art'),
    steps: listField(block, 'steps'),
    mode: strField(block, 'mode'),
    aliases: listField(block, 'aliases'),
    kind: strField(block, 'kind'),
  });
}
fs.writeFileSync('src/data/exercises.json', JSON.stringify(exercises, null, 0));
console.log('exercises', exercises.length);

// foods
const tsv = fs.readFileSync('.reference/gymmane/assets/data/foods.tsv','utf8').split('\n').filter(l=>l.trim());
const head = tsv[0].split('\t');
const col = k => head.indexOf(k);
const idx = Object.fromEntries(['id','en','k','p','c','f','fi','su','na','kind','g','an','sa','mu','po','cat','ax','ml'].map(k=>[k,col(k)]));
const foods = [];
for (const line of tsv.slice(1)) {
  const c = line.split('\t');
  if (c.length < 13) continue;
  const num = k => parseFloat(c[idx[k]]) || 0;
  foods.push({
    id: c[idx.id], name: c[idx.en],
    kcal: num('k'), protein: num('p'), carbs: num('c'), fat: num('f'),
    fiber: num('fi'), sugar: num('su'), sodium: num('na'),
    kind: c[idx.kind] || '', portionGrams: num('g'),
    animal: num('an'), sat: num('sa'), mono: num('mu'), poly: num('po'),
    cat: c[idx.cat] || '', liquid: !!c[idx.ml] && c[idx.ml] !== '', approx: !!c[idx.ax] && c[idx.ax] !== '',
  });
}
fs.writeFileSync('src/data/foods.json', JSON.stringify(foods, null, 0));
console.log('foods', foods.length);

// dishes
const dtsv = fs.readFileSync('.reference/gymmane/assets/data/dishes.tsv','utf8').split('\n').filter(l=>l.trim());
const dh = dtsv[0].split('\t');
const itemIdx = dh.indexOf('items');
const dishes = dtsv.slice(1).map(line => {
  const c = line.split('\t');
  return { id: c[0], name: c[1], items: c[itemIdx].split(' ').map(p => { const [slug, amount] = p.split(':'); return { slug, grams: (parseFloat((amount||'').replace('c',''))||0) }; }) };
});
fs.writeFileSync('src/data/dishes.json', JSON.stringify(dishes, null, 0));
console.log('dishes', dishes.length);
