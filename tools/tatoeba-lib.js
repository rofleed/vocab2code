// Tatoeba (https://tatoeba.org, CC BY 2.0 FR) English–Chinese sentence pairs.
// Expects the per-language exports, decompressed, in one directory:
//   eng_sentences.tsv, cmn_sentences.tsv, eng-cmn_links.tsv, cmn_transcriptions.tsv
// from https://downloads.tatoeba.org/exports/per_language/{eng,cmn}/

const fs = require('fs');
const path = require('path');

const MIN_WORDS = 4;
const MAX_WORDS = 14;
const MAX_CHARS = 90;
const IDEAL_WORDS = 8;

function readTsv(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
}

function tokenize(s) {
  return s.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
}

// Returns [{ en, zh, tokens }], Chinese always in simplified characters.
function loadPairs(dir) {
  const links = readTsv(path.join(dir, 'eng-cmn_links.tsv'));
  const engIds = new Set(links.map(l => l[0]));
  const cmnIds = new Set(links.map(l => l[1]));

  const eng = new Map();
  for (const [id, , text] of readTsv(path.join(dir, 'eng_sentences.tsv'))) {
    if (engIds.has(id)) eng.set(id, text);
  }
  const cmn = new Map();
  for (const [id, , text] of readTsv(path.join(dir, 'cmn_sentences.tsv'))) {
    if (cmnIds.has(id)) cmn.set(id, text);
  }
  // A "Hans" transcription exists only for sentences written in traditional
  // characters; it is their simplified rendering.
  for (const [id, , script, , text] of readTsv(path.join(dir, 'cmn_transcriptions.tsv'))) {
    if (script === 'Hans' && cmn.has(id)) cmn.set(id, text);
  }

  const pairs = [];
  const seenEng = new Set();
  for (const [e, c] of links) {
    if (seenEng.has(e)) continue; // first translation per English sentence
    const en = eng.get(e);
    const zh = cmn.get(c);
    if (!en || !zh) continue;
    const tokens = tokenize(en);
    if (tokens.length < MIN_WORDS || tokens.length > MAX_WORDS || en.length > MAX_CHARS) continue;
    seenEng.add(e);
    pairs.push({ en, zh, tokens });
  }
  return pairs;
}

// ECDICT `exchange` field, e.g. "p:abandoned/d:abandoned/i:abandoning/3:abandons".
// Keys 0 and 1 describe the lemma of this word, not its own forms.
function inflections(word, exchange) {
  const forms = new Set([word.toLowerCase()]);
  for (const part of (exchange || '').split('/')) {
    const [k, v] = part.split(':');
    if (v && k !== '0' && k !== '1') forms.add(v.toLowerCase());
  }
  return forms;
}

// Picks up to `max` example pairs per word. `words` is [{ key, word, exchange }].
// Short sentences close to IDEAL_WORDS win; sentences already used by other
// words are penalised so examples stay varied.
function matchExamples(words, pairs, max = 2) {
  const index = new Map(); // token -> pair indexes
  pairs.forEach((p, i) => {
    for (const t of new Set(p.tokens)) {
      if (!index.has(t)) index.set(t, []);
      index.get(t).push(i);
    }
  });

  const used = new Map();
  const out = new Map();
  for (const { key, word, exchange } of words) {
    const phrase = tokenize(word.replace(/-/g, ' '));
    if (!phrase.length) continue;
    let candidates;
    if (phrase.length === 1) {
      const ids = new Set();
      for (const f of inflections(word, exchange)) for (const i of index.get(f) || []) ids.add(i);
      candidates = [...ids];
    } else {
      candidates = (index.get(phrase[0]) || []).filter(i => containsSeq(pairs[i].tokens, phrase));
    }
    if (!candidates.length) continue;

    const base = phrase[0];
    const scored = candidates.map(i => {
      const p = pairs[i];
      let score = Math.abs(p.tokens.length - IDEAL_WORDS);
      if (phrase.length === 1 && !p.tokens.includes(base)) score += 1; // prefer the base form
      score += 3 * (used.get(i) || 0);
      return { i, score };
    });
    scored.sort((a, b) => a.score - b.score || a.i - b.i);
    const picked = scored.slice(0, max).map(s => s.i);
    for (const i of picked) used.set(i, (used.get(i) || 0) + 1);
    out.set(key, picked.map(i => ({ en: pairs[i].en, zh: pairs[i].zh })));
  }
  return out;
}

function containsSeq(tokens, seq) {
  outer: for (let i = 0; i + seq.length <= tokens.length; i++) {
    for (let j = 0; j < seq.length; j++) if (tokens[i + j] !== seq[j]) continue outer;
    return true;
  }
  return false;
}

module.exports = { loadPairs, matchExamples };
