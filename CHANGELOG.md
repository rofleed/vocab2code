# Changelog

## Unreleased

- Require VS Code 1.82+ for its Node 18 runtime and built-in fetch API.

- Disable audio preloading and progress sync by default; add explicit opt-in settings.
- Add commands to clear audio cache, logs, and learning progress.
- Remove text and remote error details from diagnostic logs.
- Preserve bundled examples and add sentence-level attribution recovery and publish checks.
- Restrict VSIX contents and add release checks and CI.


## 0.9.0

- Renamed from `elanguage` to `vocab2code`. Commands, settings and stored
  progress use the new `vocab2code.` prefix; settings and progress from
  `elanguage` are not carried over.

### Libraries
- Libraries are discovered automatically from the bundled `data/` folder, the
  user library folder (`vocab2code: Open User Library Folder`) and the new
  `vocab2code.libraryPaths` setting. No code change is needed to add one.
- New library format `{ meta, words }` with a JSON Schema
  (`schema/library.schema.json`). The old bare-array format still works.
- Word entries can be plain strings, resolved through a shared dictionary
  (`dict/ecdict.json`, schema in `schema/dictionary.schema.json`).
- Bundled libraries replaced with complete word lists built from ECDICT (MIT):
  zhongkao, gaokao, cet4, cet6, kaoyan, toefl, ielts, gre.
- New command `vocab2code: Import Library`: `.txt`, `.csv`, `.tsv`, `.json`, and
  kajweb/dict books (`.json` or `.zip`).

### Progress
- Marks are now stored once per word and shared by all libraries, and synced
  via Settings Sync.

### Dictionary
- English–Chinese example sentences from Tatoeba (CC BY 2.0 FR), up to 2 per
  word (e.g. 88% of CET-4 words).
- Dictionary senses trimmed to at most 4 general senses per word.

### Display
- `vocab2code.hideEmptySenses` now defaults to `false`.
- Words without any example sentence show all their senses.
- Multi-part parts of speech (e.g. `v./n.`) render correctly.

### Tools
- `tools/build-ecdict.js` builds the dictionary and exam word lists.
- `tools/import-apkg.js` takes the note model and field positions as flags.
