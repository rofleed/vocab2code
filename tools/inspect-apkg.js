// Usage: node tools/inspect-apkg.js <path-to.apkg>
// Prints note models, deck names, total notes, and first 5 notes (field-split).

const fs = require('fs');
const path = require('path');
const { unzipSync } = require('fflate');
const fzstd = require('fzstd');
const initSqlJs = require('sql.js');

async function main() {
  const apkgPath = process.argv[2];
  if (!apkgPath) {
    console.error('usage: node tools/inspect-apkg.js <file.apkg>');
    process.exit(1);
  }
  const buf = fs.readFileSync(apkgPath);
  const files = unzipSync(new Uint8Array(buf));
  console.log('entries:', Object.keys(files));

  let dbBytes;
  if (files['collection.anki21b']) {
    console.log('format: anki21b (zstd-compressed sqlite)');
    dbBytes = fzstd.decompress(files['collection.anki21b']);
  } else if (files['collection.anki21']) {
    console.log('format: anki21 (sqlite)');
    dbBytes = files['collection.anki21'];
  } else if (files['collection.anki2']) {
    console.log('format: anki2 (sqlite)');
    dbBytes = files['collection.anki2'];
  } else {
    console.error('no collection file found');
    process.exit(2);
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(dbBytes);

  const tables = db.exec("select name from sqlite_master where type='table'");
  console.log('tables:', tables[0]?.values.flat());

  // models live in col.models (json blob)
  const colRes = db.exec('select models, decks from col limit 1');
  if (colRes.length && colRes[0].values.length) {
    const [modelsJson, decksJson] = colRes[0].values[0];
    if (modelsJson) {
      const models = JSON.parse(modelsJson);
      console.log('\n=== models ===');
      for (const id of Object.keys(models)) {
        const m = models[id];
        console.log(`model ${id}: name=${m.name}`);
        console.log(`  fields:`, m.flds.map(f => f.name));
      }
    }
    if (decksJson) {
      const decks = JSON.parse(decksJson);
      console.log('\n=== decks ===');
      for (const id of Object.keys(decks)) {
        const d = decks[id];
        console.log(`deck ${id}: ${d.name}`);
      }
    }
  } else {
    // newer anki may keep models in dedicated tables
    const altTables = ['notetypes', 'fields', 'decks'];
    for (const t of altTables) {
      const r = db.exec(`select * from ${t} limit 30`);
      if (r.length) {
        console.log(`\n=== ${t} ===`);
        console.log(r[0].columns);
        for (const row of r[0].values) console.log(row);
      }
    }
  }

  // counts
  try {
    const cnt = db.exec('select count(*) from notes');
    console.log('\nnotes total:', cnt[0].values[0][0]);
  } catch {}

  // sample notes
  try {
    const sample = db.exec('select id, mid, flds from notes limit 5');
    if (sample.length) {
      console.log('\n=== sample notes ===');
      for (const row of sample[0].values) {
        const [id, mid, flds] = row;
        const fields = String(flds).split('\x1f');
        console.log(`note ${id} (model ${mid}):`);
        fields.forEach((f, i) => console.log(`  [${i}] ${f.slice(0, 200).replace(/\n/g, ' ')}${f.length > 200 ? ' …' : ''}`));
      }
    }
  } catch (e) {
    console.error('notes read failed:', e.message);
  }

  db.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
