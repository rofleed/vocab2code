// Usage: node tools/inspect-model.js <apkg> <modelId> [limit]
const fs = require('fs');
const { unzipSync } = require('fflate');
const initSqlJs = require('sql.js');

async function main() {
  const [, , apkgPath, mid, limitStr] = process.argv;
  if (!apkgPath || !mid) {
    console.error('usage: node tools/inspect-model.js <apkg> <modelId> [limit]');
    process.exit(1);
  }
  const limit = parseInt(limitStr || '5', 10);
  const buf = fs.readFileSync(apkgPath);
  const files = unzipSync(new Uint8Array(buf));
  const dbBytes = files['collection.anki21'] || files['collection.anki2'];
  const SQL = await initSqlJs();
  const db = new SQL.Database(dbBytes);

  const r = db.exec(`select id, flds from notes where mid = ${mid} limit ${limit}`);
  if (!r.length) {
    console.log('no notes for that model');
    return;
  }
  for (const row of r[0].values) {
    const [id, flds] = row;
    const fields = String(flds).split('\x1f');
    console.log(`--- note ${id} ---`);
    fields.forEach((f, i) => {
      const preview = f.length > 400 ? f.slice(0, 400) + ' …' : f;
      console.log(`[${i}] ${preview}`);
    });
  }
  db.close();
}
main().catch(e => { console.error(e); process.exit(1); });
