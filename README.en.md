<div align="center">

<img src="images/icon.png" width="128" alt="vocab2code">

# vocab2code

[简体中文](README.md) | English

Study vocabulary while "coding" in VS Code: each day's words are rendered as a TypeScript module, so a passer-by only sees source code. Definitions and translations are in Chinese.

</div>

## Features

- Bundled word lists for Chinese exams (中考 → 考研), TOEFL, IELTS and GRE, with Chinese definitions and example sentences
- Buttons above each word: ▶ play · ✓ known · ✗ hard · ↺ reset
- Known words are skipped for a while, hard words come up more often
- Import your own word lists (txt / csv / json / kajweb zip)
- Progress is shared across libraries with optional VS Code Settings Sync (off by default)
- Word and sentence playback; click `enable()` in the audio panel the first time

## Screenshot

<img width="831" height="884" alt="image" src="https://github.com/user-attachments/assets/d48d4234-52b1-42fc-82fd-0f0cf28385eb" />

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
| `vocab2code.engine` | `baidu` | Preferred sentence service: `baidu` / `google` / `edge` |
| `vocab2code.libraryPaths` | `[]` | Extra library folders or files |
| `vocab2code.audioPrefetch` | `false` | Preload audio for today's words and examples in the background (recommended) |

### Audio preloading (recommended)

Played audio is cached locally, so replays don't hit the network. The first play of a word or sentence still has to download it, which can take a few seconds on a slow connection.

We recommend turning preloading on: open Settings (`Ctrl+,`), search for `vocab2code.audioPrefetch` and tick it, or add this to `settings.json`:

```json
"vocab2code.audioPrefetch": true
```

It takes effect right away: the extension downloads audio for all of today's words and example sentences in the background, and tops it up again on VS Code startup, when you open today's module, or when you switch library or accent. After that, ▶ plays almost instantly. Note that this sends the text to the speech services before you press play; see [Privacy](#privacy).

Run `vocab2code: Clear Audio Cache` to clear the cache.

Words use Youdao first; sentences default to Baidu Translate for mainland China connectivity. When Youdao fails, words try the selected engine. Google and Edge fall back to Baidu; Baidu falls back to Google. Failed routes are skipped for 30 seconds. Long sentences are split without truncation, and downloaded audio is cached locally.

If you previously selected Google or Edge, set `vocab2code.engine` to `baidu` to reduce connection waits in mainland China. Run `vocab2code: Show Log` for route timings and error categories (HTTP status, timeout or DNS failure), without vocabulary text.

## Importing

- `.txt`: one word per line, definitions are looked up in the bundled dictionary
- `.csv` / `.tsv`: `word, definition, example, translation`
- `.json`: vocab2code library format, see [CONTRIBUTING.md](CONTRIBUTING.md)
- [kajweb/dict](https://github.com/kajweb/dict) `.json` / `.zip` (not bundled, download it yourself)

Imported libraries stay local; `vocab2code: Open User Library Folder` shows them.

## Privacy

Audio preloading is off by default. Playing uncached words or sentences sends that text to unofficial Youdao, Baidu Translate, Google Translate or Edge read-aloud services. Audio preloading and progress sync are opt-in. See [PRIVACY.md](PRIVACY.md) for data handling and deletion controls.

## Development

Use Node.js 22 for building and packaging. See [RELEASING.md](RELEASING.md).

```sh
npm ci
npm run compile   # then press F5 in VS Code
```

Library format, data build scripts and contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md) (Chinese).

## License

Code: [MIT](LICENSE). Dictionary from [ECDICT](https://github.com/skywind3000/ECDICT) (MIT). Examples are from Tatoeba (CC BY 2.0 FR); see [sentence attribution](attribution/tatoeba.json). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
