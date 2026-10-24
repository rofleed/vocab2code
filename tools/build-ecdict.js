// Usage: node tools/build-ecdict.js <ecdict.csv> [--top 20000] [--tatoeba <dir>] [--examples 2]
// Builds from ECDICT (https://github.com/skywind3000/ECDICT, MIT):
//   dict/ecdict.json  — shared dictionary: every exam-tagged word + the top-N
//                       most frequent words (by frq / bnc rank)
//   data/<id>.json    — exam word lists (string entries, resolved through the
//                       dictionary at runtime)
// With --tatoeba, each dictionary entry also gets up to N English–Chinese
// example sentences from Tatoeba (see tools/tatoeba-lib.js for the files).
// Hand-written object entries already present in data/<id>.json (e.g. ones
// with example sentences) are kept and take precedence over plain strings.

const fs = require('fs');
const path = require('path');
const { parseTranslation, readEcdict } = require('./ecdict-lib');
const { loadPairs, matchExamples } = require('./tatoeba-lib');

const ROOT = path.join(__dirname, '..');

// ECDICT tag -> library meta
const LISTS = {
  zk:    { id: 'zhongkao', name: '中考词汇' },
  gk:    { id: 'gaokao',   name: '高考词汇' },
  cet4:  { id: 'cet4',     name: 'CET-4 四级词汇' },
  cet6:  { id: 'cet6',     name: 'CET-6 六级词汇' },
  ky:    { id: 'kaoyan',   name: '考研词汇' },
  toefl: { id: 'toefl',    name: 'TOEFL 托福词汇' },
  ielts: { id: 'ielts',    name: 'IELTS 雅思词汇' },
  gre:   { id: 'gre',      name: 'GRE 词汇' }
};

const SOURCE = 'ECDICT (https://github.com/skywind3000/ECDICT)';
const TATOEBA_SOURCE = 'Tatoeba (https://tatoeba.org)';

const MAX_SENSES = 4;
const DOMAIN_RE = /^\[[^\]]+\]/;                 // "[医] ...", "[计] ..."
const FORM_NOTE_RE = /的(过去式|过去分词|现在分词|复数|第三人称|比较级|最高级)/; // "run的过去式和过去分词"

// Drops domain-specific senses and inflection notes when the word has other
// senses, then keeps at most MAX_SENSES.
function cleanSenses(senses) {
  const general = senses.filter(s => !DOMAIN_RE.test(s.definition) && !FORM_NOTE_RE.test(s.definition));
  return (general.length ? general : senses).slice(0, MAX_SENSES);
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
}

function main() {
  const csvPath = process.argv[2];
  if (!csvPath || csvPath.startsWith('--')) {
    console.error('usage: node tools/build-ecdict.js <ecdict.csv> [--top 20000]');
    process.exit(1);
  }
  const top = Number(arg('--top', 20000));
  const tatoebaDir = arg('--tatoeba');
  const maxExamples = Number(arg('--examples', 2));

  console.log('reading', csvPath);
  const rows = readEcdict(csvPath);

  const entries = {};
  const exchanges = {};
  const lists = Object.fromEntries(Object.keys(LISTS).map(t => [t, []]));
  for (const r of rows) {
    const word = r.word.trim();
    const key = word.toLowerCase();
    if (!word || !r.translation || entries[key]) continue;
    const tags = r.tag.split(/\s+/).filter(t => t in LISTS);
    const rank = Math.min(Number(r.frq) || Infinity, Number(r.bnc) || Infinity);
    if (!tags.length && rank > top) continue;

    const senses = cleanSenses(parseTranslation(r.translation));
    if (!senses.length) continue;
    entries[key] = {
      // ECDICT writes schwa as Cyrillic "ә" (U+04D9); use IPA "ə" (U+0259)
      phonetic: r.phonetic ? `/${r.phonetic.replace(/ә/g, 'ə')}/` : '',
      senses
    };
    exchanges[key] = { word, exchange: r.exchange };
    for (const t of tags) lists[t].push(word);
  }

  if (tatoebaDir) {
    console.log('reading tatoeba', tatoebaDir);
    const pairs = loadPairs(tatoebaDir);
    const words = Object.entries(exchanges).map(([key, v]) => ({ key, ...v }));
    const examples = matchExamples(words, pairs, maxExamples);
    for (const [key, ex] of examples) entries[key].examples = ex;
    console.log(`tatoeba: ${pairs.length} pairs, examples for ${examples.size}/${words.length} words`);
  }

  const dict = {
    meta: {
      id: 'ecdict',
      name: 'ECDICT core',
      schema: 1,
      lang: 'en',
      defLang: 'zh-CN',
      count: Object.keys(entries).length,
      license: tatoebaDir ? 'MIT (definitions), CC BY 2.0 FR (examples)' : 'MIT',
      source: tatoebaDir ? `${SOURCE}; examples: ${TATOEBA_SOURCE}` : SOURCE
    },
    entries
  };
  const dictPath = path.join(ROOT, 'dict', 'ecdict.json');
  fs.mkdirSync(path.dirname(dictPath), { recursive: true });
  fs.writeFileSync(dictPath, JSON.stringify(dict) + '\n', 'utf8');
  console.log(`dict: ${dict.meta.count} entries -> ${dictPath}`);

  for (const [tag, words] of Object.entries(lists)) {
    const { id, name } = LISTS[tag];
    const outPath = path.join(ROOT, 'data', `${id}.json`);
    const kept = existingObjects(outPath);
    const keptKeys = new Set(kept.map(e => e.word.toLowerCase()));
    const merged = [
      ...kept,
      ...words.filter(w => !keptKeys.has(w.toLowerCase()))
    ].sort((a, b) => wordOf(a).localeCompare(wordOf(b)));

    const lib = {
      $schema: '../schema/library.schema.json',
      meta: {
        id,
        name,
        description: `${name}（ECDICT 标签 ${tag}），释义来自 ECDICT。`,
        version: '1.0.0',
        schema: 1,
        lang: 'en',
        defLang: 'zh-CN',
        count: merged.length,
        license: 'MIT',
        source: SOURCE
      },
      words: merged
    };
    fs.writeFileSync(outPath, formatLibrary(lib), 'utf8');
    console.log(`${id}: ${merged.length} words (${kept.length} hand-written kept) -> ${outPath}`);
  }
}

function wordOf(e) {
  return typeof e === 'string' ? e : e.word;
}

function existingObjects(file) {
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const words = Array.isArray(raw) ? raw : raw.words || [];
  return words.filter(w => w && typeof w === 'object');
}

// One string entry per line keeps diffs of word lists readable.
function formatLibrary(lib) {
  const words = lib.words.map(w => '    ' + JSON.stringify(w)).join(',\n');
  const head = JSON.stringify({ $schema: lib.$schema, meta: lib.meta }, null, 2).replace(/\n}$/, '');
  return `${head},\n  "words": [\n${words}\n  ]\n}\n`;
}

main();
