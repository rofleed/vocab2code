// Usage: node tools/import-apkg.js <apkg-path> <output-json>
//          [--model <mid>] [--word 0] [--def 5] [--example 6] [--ipa 7] [--id <id>] [--name <name>]
// Field indices are 0-based positions in the note's fields; use
// tools/inspect-apkg.js to find the model id and field layout of a deck.
// Defaults match the 4000 Essential English Words deck (mid=1434531251879).
const fs = require('fs');
const path = require('path');
const { unzipSync } = require('fflate');
const initSqlJs = require('sql.js');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
}

const MODEL_ID = arg('--model', '1434531251879');
const FIELD = {
  word: Number(arg('--word', 0)),
  def: Number(arg('--def', 5)),
  example: Number(arg('--example', 6)),
  ipa: Number(arg('--ipa', 7))
};

function stripHtml(s) {
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanIpa(s) {
  if (!s) return '';
  const v = stripHtml(s).replace(/^\[|\]$/g, '').trim();
  return v ? `/${v}/` : '';
}

async function main() {
  const [, , apkgPath, outPath] = process.argv;
  if (!apkgPath || !outPath || apkgPath.startsWith('--') || outPath.startsWith('--')) {
    console.error('usage: node tools/import-apkg.js <apkg> <output.json> [--model <mid>] [--word N] [--def N] [--example N] [--ipa N]');
    process.exit(1);
  }
  const buf = fs.readFileSync(apkgPath);
  const files = unzipSync(new Uint8Array(buf));
  const dbBytes = files['collection.anki21'] || files['collection.anki2'];
  if (!dbBytes) { console.error('no sqlite found'); process.exit(2); }
  const SQL = await initSqlJs();
  const db = new SQL.Database(dbBytes);

  const r = db.exec(`select id, flds from notes where mid = ${Number(MODEL_ID)}`);
  if (!r.length) { console.error('no notes for main model'); process.exit(3); }

  const seen = new Set();
  const entries = [];
  for (const row of r[0].values) {
    const flds = String(row[1]).split('\x1f');
    const word = stripHtml(flds[FIELD.word]).toLowerCase();
    if (!word || seen.has(word)) continue;
    seen.add(word);

    const meaning = stripHtml(flds[FIELD.def]);
    const example = stripHtml(flds[FIELD.example]);
    const ipa = cleanIpa(flds[FIELD.ipa]);

    entries.push({
      word,
      phonetic: ipa,
      senses: [
        {
          pos: '',
          definition: meaning,
          examples: example ? [{ en: example, zh: '' }] : []
        }
      ]
    });
  }
  db.close();

  entries.sort((a, b) => a.word.localeCompare(b.word));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const id = arg('--id', path.basename(outPath, path.extname(outPath)));
  const lib = {
    meta: {
      id,
      name: arg('--name', id),
      schema: 1,
      count: entries.length,
      source: path.basename(apkgPath)
    },
    words: entries
  };
  fs.writeFileSync(outPath, JSON.stringify(lib, null, 2), 'utf8');
  console.log(`wrote ${entries.length} entries -> ${outPath}`);
}
main().catch(e => { console.error(e); process.exit(1); });
