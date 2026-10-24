// Offline checks for the reviewed release data and common credential patterns.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const libraries = ['cet4', 'cet6', 'gaokao', 'gre', 'ielts', 'kaoyan', 'toefl', 'zhongkao'];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dict = JSON.parse(fs.readFileSync(path.join(root, 'dict/ecdict.json'), 'utf8'));
assert.equal(dict.meta.license, 'MIT (definitions), CC BY 2.0 FR (examples)');
assert.equal(Object.keys(dict.entries).length, dict.meta.count);
const attributionPath = path.join(root, 'attribution/tatoeba.json');
const attribution = fs.existsSync(attributionPath) ? JSON.parse(fs.readFileSync(attributionPath, 'utf8')) : { sentences: {} };
const unresolved = new Set();
let examples = 0;
for (const [word, entry] of Object.entries(dict.entries)) {
  for (const example of entry.examples ?? []) {
    examples++;
    for (const [lang, field] of [['eng', 'en'], ['cmn', 'zh']]) {
      if (!example[field]) continue;
      const key = createHash('sha256').update(lang + ':' + example[field]).digest('hex');
      const records = attribution.sentences[key];
      if (!records?.length || records.some(r => (!r.author && r.authorStatus !== 'unassigned') || !r.id || r.url !== `https://tatoeba.org/en/sentences/show/${r.id}`)) unresolved.add(key);
    }
  }
  assert(entry.senses.length, `No definitions: ${word}`);
  for (const sense of entry.senses) assert.equal(sense.examples?.length ?? 0, 0, `Unreviewed examples: ${word}`);
}
for (const id of libraries) {
  const lib = JSON.parse(fs.readFileSync(path.join(root, 'data', id + '.json'), 'utf8'));
  assert.equal(lib.meta.license, 'MIT');
  assert.equal(lib.words.length, lib.meta.count);
  for (const word of lib.words) {
    assert.equal(typeof word, 'string', `Unreviewed object entry in ${id}`);
    assert(dict.entries[word.toLowerCase()], `Missing definition: ${id}/${word}`);
  }
}
const credential = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|sk-(?:proj-|ant-)[A-Za-z0-9_-]{30,}/;
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'out'].includes(entry.name) || entry.name.endsWith('.vsix')) continue;
    const file = path.join(dir, entry.name);
    assert(!entry.isSymbolicLink(), `Review symlink before release: ${path.relative(root, file)}`);
    if (entry.isDirectory()) scan(file);
    else assert(!credential.test(fs.readFileSync(file, 'utf8')), `Possible credential: ${path.relative(root, file)}`);
  }
}
scan(root);
assert.equal(pkg.contributes.configuration.properties['vocab2code.audioPrefetch'].default, false);
assert.equal(pkg.contributes.configuration.properties['vocab2code.syncProgress'].default, false);
if (process.argv.includes('--publish')) {
  assert(pkg.publisher && pkg.publisher !== 'local', 'Set publisher to your registered Marketplace publisher ID before publishing.');
  assert(pkg.repository?.url && pkg.bugs?.url, 'Set repository and issue URLs.');
}
if (process.argv.includes('--publish') || process.argv.includes('--attribution')) {
  assert.equal(unresolved.size, 0, `${unresolved.size} unique sentences still need source verification before distribution.`);
}
if (unresolved.size) console.warn(`LOCAL PREVIEW ONLY: ${unresolved.size} unique sentences need source verification; distribution check is blocked.`);
console.log(`Release checks passed: ${libraries.length} libraries, ${dict.meta.count} entries, ${examples} retained examples, no common credential matches.`);
