const fs = require('node:fs');
const assert = require('node:assert/strict');
const { unzipSync, strFromU8 } = require('fflate');
const file = process.argv[2] || `${require('../package.json').name}-${require('../package.json').version}.vsix`;
const zip = unzipSync(fs.readFileSync(file));
const required = [
  'package.json', 'out/extension.js', 'dict/ecdict.json',
  ...['cet4', 'cet6', 'gaokao', 'gre', 'ielts', 'kaoyan', 'toefl', 'zhongkao'].map(id => `data/${id}.json`),
  'schema/dictionary.schema.json', 'schema/library.schema.json',
  'readme.md', 'README.en.md', 'LICENSE.txt', 'THIRD_PARTY_NOTICES.md', 'PRIVACY.md',
  'changelog.md', 'CONTRIBUTING.md', 'RELEASING.md', 'attribution/tatoeba.json'
];
const allowed = new Set(['[Content_Types].xml', 'extension.vsixmanifest', ...required.map(p => `extension/${p}`)]);
for (const name of Object.keys(zip)) assert(allowed.has(name), `Unexpected VSIX entry: ${name}`);
for (const name of required) assert(zip['extension/' + name]?.length, `Missing VSIX entry: ${name}`);
const dict = JSON.parse(strFromU8(zip['extension/dict/ecdict.json']));
const expected = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../dict/ecdict.json'), 'utf8'));
assert.deepEqual(dict, expected, 'Packaged dictionary differs from reviewed source');
assert.equal(strFromU8(zip['extension/attribution/tatoeba.json']), fs.readFileSync(require('node:path').join(__dirname, '../attribution/tatoeba.json'), 'utf8'));
console.log(`VSIX verified: ${Object.keys(zip).length} allowed files, runtime bundle and notices present.`);
