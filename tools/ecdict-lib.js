// Shared ECDICT helpers (https://github.com/skywind3000/ECDICT, MIT).

function parseCsv(text) {
  // Streaming-style state machine. Returns array of rows (each row = array of fields).
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      field += c; i++;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const POS_RE = /^\s*(n|v|vt|vi|adj|adv|prep|conj|pron|art|int|num|aux|abbr|s|pl|a)\.\s*/i;

function parseTranslation(raw) {
  if (!raw) return [];
  // ECDICT uses literal "\n" (two chars) to separate senses
  const parts = raw.split('\\n').map(s => s.trim()).filter(Boolean);
  const senses = [];
  for (const p of parts) {
    if (p.startsWith('[网络]')) continue; // skip network examples
    const m = POS_RE.exec(p);
    let pos = '';
    let def = p;
    if (m) {
      pos = m[1].toLowerCase() === 'a' ? 'adj.' : m[1].toLowerCase() + '.';  // ECDICT uses "a." for adjectives
      def = p.slice(m[0].length).trim();
    }
    if (def) senses.push({ pos, definition: def });
  }
  return senses;
}


// Reads ecdict.csv into rows of { header: value } objects.
function readEcdict(csvPath) {
  const fs = require('fs');
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const headers = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const o = {};
    headers.forEach((h, j) => { o[h] = r[j] || ''; });
    out.push(o);
  }
  return out;
}

module.exports = { parseCsv, parseTranslation, readEcdict };
