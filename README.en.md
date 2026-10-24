# vocab2code

[简体中文](README.md) | English

Study vocabulary while "coding" in VS Code: each day's words are rendered as a TypeScript module, so a passer-by only sees source code.

```ts
/**
 * #01  abandon  /ə'bændən/
 */
const abandon = phonetic("/ə'bændən/");
// @vt  放弃, 抛弃
```

Definitions and translations are in Chinese.

## Features

- Bundled word lists for Chinese exams (中考 → 考研), TOEFL, IELTS and GRE, with Chinese definitions and example sentences
- Buttons above each word: ▶ play · ✓ known · ✗ hard · ↺ reset
- Known words are skipped for a while, hard words come up more often
- Import your own word lists (txt / csv / json / kajweb zip)
- Progress is shared across libraries with optional VS Code Settings Sync (off by default)

## Usage

Requires VS Code 1.82 or newer.

1. `Ctrl+Shift+P` → `vocab2code: Open Daily Module`
2. `vocab2code: Switch Library` to change the word list
3. `vocab2code: Import Library` to import your own

Common settings:

| Setting | Default | |
| --- | --- | --- |
| `vocab2code.library` | `ielts` | Current library |
| `vocab2code.dailyCount` | `20` | Words per day |
| `vocab2code.knownCooldownDays` | `7` | Days to skip a known word |
| `vocab2code.audioAccent` | `us` | `us` / `uk` |
| `vocab2code.libraryPaths` | `[]` | Extra library folders or files |

## Importing

- `.txt`: one word per line, definitions are looked up in the bundled dictionary
- `.csv` / `.tsv`: `word, definition, example, translation`
- `.json`: vocab2code library format, see [CONTRIBUTING.md](CONTRIBUTING.md)
- [kajweb/dict](https://github.com/kajweb/dict) `.json` / `.zip` (not bundled, download it yourself)

Imported libraries stay local; `vocab2code: Open User Library Folder` shows them.

## Privacy

Audio preloading is off by default. Playing uncached words or sentences sends that text to unofficial Youdao, Google Translate or Edge read-aloud services. Audio preloading and progress sync are opt-in. See [PRIVACY.md](PRIVACY.md) for data handling and deletion controls.

## Development

Use Node.js 22 for building and packaging. See [RELEASING.md](RELEASING.md).

```sh
npm ci
npm run compile   # then press F5 in VS Code
```

Library format, data build scripts and contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md) (Chinese).

## License

Code: [MIT](LICENSE). Dictionary from [ECDICT](https://github.com/skywind3000/ECDICT) (MIT). Examples are from Tatoeba (CC BY 2.0 FR); see [sentence attribution](attribution/tatoeba.json). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
