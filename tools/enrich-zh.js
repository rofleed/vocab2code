// Usage: node tools/enrich-zh.js <ecdict.csv> <target.json>
// Replaces senses with Chinese translations from ECDICT.
// Keeps examples (attached to first parsed sense).

const fs = require('fs');
const path = require('path');
const { parseCsv, parseTranslation } = require('./ecdict-lib');

function main() {
  const [, , csvPath, jsonPath] = process.argv;
  if (!csvPath || !jsonPath) {
    console.error('usage: node tools/enrich-zh.js <ecdict.csv> <target.json>');
    process.exit(1);
  }

  console.log('reading csv...');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  console.log('parsing csv...');
  const rows = parseCsv(csvText);
  const headers = rows[0];
  const idx = {
    word: headers.indexOf('word'),
    translation: headers.indexOf('translation'),
    phonetic: headers.indexOf('phonetic')
  };
  console.log('rows:', rows.length - 1, 'columns:', headers);

  // build map (word lowercased -> {translation, phonetic})
  const map = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[idx.word]) continue;
    const w = r[idx.word].toLowerCase().trim();
    if (!w) continue;
    if (map.has(w)) continue; // first wins
    map.set(w, {
      translation: r[idx.translation] || '',
      phonetic: r[idx.phonetic] || ''
    });
  }
  console.log('dict size:', map.size);

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let hit = 0, miss = 0;
  for (const entry of data) {
    const key = entry.word.toLowerCase();
    const dict = map.get(key);
    if (!dict || !dict.translation) { miss++; continue; }
    const senses = parseTranslation(dict.translation);
    if (!senses.length) { miss++; continue; }
    // preserve existing examples on the first parsed sense
    const oldExamples = entry.senses?.[0]?.examples || [];
    senses[0].examples = oldExamples;
    for (let i = 1; i < senses.length; i++) senses[i].examples = [];
    entry.senses = senses;
    // backfill phonetic if missing
    if (!entry.phonetic && dict.phonetic) entry.phonetic = `/${dict.phonetic}/`;
    hit++;
  }
  console.log(`enriched ${hit}, no-match ${miss}, total ${data.length}`);

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('saved', jsonPath);
}

main();
