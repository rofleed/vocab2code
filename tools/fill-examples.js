// Usage: node tools/fill-examples.js <library.json>
// For each multi-sense entry where one or more senses have no examples,
// fetch dictionaryapi.dev and attach an English example matched by POS.
// Translation is left for translate-zh.js to do in a subsequent pass.

const fs = require('fs');
const path = require('path');

const CONCURRENCY = 1;
const DELAY_MS = 900;
const RETRY_429_MS = 5000;
const CACHE_PATH_SUFFIX = '.dictapi-noentry.json';

// Map ECDICT short pos → list of dictionaryapi.dev "partOfSpeech" values
const POS_MAP = {
  'v.':    ['verb'],
  'vt.':   ['verb', 'transitive verb'],
  'vi.':   ['verb', 'intransitive verb'],
  'n.':    ['noun'],
  'adj.':  ['adjective'],
  'adv.':  ['adverb'],
  'prep.': ['preposition'],
  'conj.': ['conjunction'],
  'pron.': ['pronoun'],
  'int.':  ['interjection'],
  'num.':  ['numeral', 'number'],
  'art.':  ['article'],
  'abbr.': ['abbreviation']
};

// Returns { status: 'ok', data } | { status: 'notfound' } | { status: 'ratelimit' } | { status: 'err' }
async function fetchEntry(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 429) return { status: 'ratelimit' };
    if (res.status === 404) return { status: 'notfound' };
    if (!res.ok) return { status: 'err' };
    return { status: 'ok', data: await res.json() };
  } catch {
    return { status: 'err' };
  } finally {
    clearTimeout(t);
  }
}

function extractByPos(entryData) {
  const map = new Map(); // partOfSpeech → string[]
  if (!Array.isArray(entryData)) return map;
  for (const entry of entryData) {
    for (const m of (entry.meanings || [])) {
      const pos = String(m.partOfSpeech || '').toLowerCase();
      if (!pos) continue;
      if (!map.has(pos)) map.set(pos, []);
      const arr = map.get(pos);
      for (const d of (m.definitions || [])) {
        if (d.example && typeof d.example === 'string') {
          arr.push(d.example);
        }
      }
    }
  }
  return map;
}

function pickExampleForSense(sense, examplesByPos) {
  const candidates = POS_MAP[sense.pos] || [];
  for (const c of candidates) {
    const arr = examplesByPos.get(c);
    if (arr && arr.length) return arr[0];
  }
  return null;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tools/fill-examples.js <library.json>');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const noEntryPath = path.join(path.dirname(file), path.basename(file, '.json') + CACHE_PATH_SUFFIX);
  let noEntryCache = {};
  if (fs.existsSync(noEntryPath)) {
    try { noEntryCache = JSON.parse(fs.readFileSync(noEntryPath, 'utf8')); } catch {}
  }
  const saveCache = () => fs.writeFileSync(noEntryPath, JSON.stringify(noEntryCache), 'utf8');

  // Collect candidates: multi-sense entries with at least one empty sense
  // (and not previously known to be absent from dictapi).
  const targets = data.filter(e =>
    e.senses && e.senses.length > 1 &&
    e.senses.some(s => !s.examples || s.examples.length === 0) &&
    !noEntryCache[e.word]
  );
  console.log('target words:', targets.length, '(skipped cached notfound:', Object.keys(noEntryCache).length + ')');

  let idx = 0;
  let processed = 0;
  let attached = 0;
  let noEntry = 0;
  let lastSave = Date.now();

  const saveAll = () => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  };

  async function worker(id) {
    while (idx < targets.length) {
      const entry = targets[idx++];
      let r = await fetchEntry(entry.word);
      // 429 backoff with one retry, then defer
      while (r.status === 'ratelimit') {
        console.log(`429 — sleeping ${RETRY_429_MS}ms then retrying ${entry.word}`);
        await new Promise(rs => setTimeout(rs, RETRY_429_MS));
        r = await fetchEntry(entry.word);
      }
      if (r.status === 'ok') {
        const examplesByPos = extractByPos(r.data);
        for (const sense of entry.senses) {
          if (sense.examples && sense.examples.length > 0) continue;
          const en = pickExampleForSense(sense, examplesByPos);
          if (en) {
            if (!sense.examples) sense.examples = [];
            sense.examples.push({ en, zh: '' });
            attached++;
          }
        }
      } else if (r.status === 'notfound') {
        noEntryCache[entry.word] = 1;
        noEntry++;
      }
      processed++;
      if (processed % 50 === 0) {
        console.log(`progress: ${processed}/${targets.length}  attached=${attached}  noEntry=${noEntry}`);
      }
      if (Date.now() - lastSave > 15000) { saveAll(); saveCache(); lastSave = Date.now(); }
      await new Promise(rs => setTimeout(rs, DELAY_MS));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  saveAll();
  saveCache();
  console.log(`done. processed=${processed} attached=${attached} noEntry=${noEntry}`);
}

main().catch(err => { console.error(err); process.exit(1); });
