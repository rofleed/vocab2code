const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loader, host } = require('./helpers');

test('AudioPlayer does not enqueue unless preloading is explicitly enabled', () => {
  const settings = {};
  let calls = 0;
  const { AudioPlayer } = loader({
    vscode: host(settings),
    './audioCache': { AudioCache: class { enqueue() { calls++; } stopPrefetch() {} } },
    './logger': { log() {} }
  })('audio');
  const player = new AudioPlayer({});
  player.prefetch([{ text: 'private example' }]);
  assert.equal(calls, 0);
  settings.audioPrefetch = true;
  player.prefetch([{ text: 'private example' }]);
  assert.equal(calls, 1);
});

test('activation and refresh are offline by default; disabling prefetch stops queued work', () => {
  const settings = {};
  const vscode = host(settings);
  const commands = new Map();
  let changed, prefetches = 0, stops = 0;
  vscode.commands = { registerCommand: (id, fn) => { commands.set(id, fn); return {}; } };
  vscode.languages = { registerCodeLensProvider: () => ({}) };
  vscode.workspace.registerTextDocumentContentProvider = () => ({});
  vscode.workspace.onDidChangeConfiguration = fn => { changed = fn; return {}; };
  const load = loader({
    vscode,
    './wordStore': { WordStore: class { loadLibrary() { return []; } getProgress() { return {}; } configureSync() {} } },
    './viewProvider': { DailyDocumentProvider: class { refresh() {} }, SCHEME: 'test' },
    './codeLensProvider': { DailyCodeLensProvider: class { refresh() {} } },
    './audio': { AudioPlayer: class { prefetch() { prefetches++; } stopPrefetch() { stops++; } } },
    './dailyPicker': { pickDaily: () => [{ word: 'hello', senses: [] }] },
    './importer': {}, './logger': { initLogger() {}, log() {} }
  });
  load('extension').activate({ subscriptions: [] });
  commands.get('vocab2code.refresh')();
  assert.equal(prefetches, 0);
  settings.audioPrefetch = true;
  changed({ affectsConfiguration: key => ['vocab2code', 'vocab2code.audioPrefetch'].includes(key) });
  assert.equal(prefetches, 1);
  settings.audioPrefetch = false;
  const previousStops = stops;
  changed({ affectsConfiguration: key => ['vocab2code', 'vocab2code.audioPrefetch'].includes(key) });
  assert(stops > previousStops);
  assert.equal(prefetches, 1);
});

test('clearing audio waits for active requests and prevents queued files reappearing', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-cache-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const releases = [];
  const logs = [];
  let requests = 0;
  const { AudioCache } = loader({
    vscode: host(), './logger': { log: (...args) => logs.push(args.join(' ')) },
    './edgeTts': {},
    './tts': { googleTts: () => { requests++; return new Promise(resolve => releases.push(() => resolve(Buffer.from('ID3test')))); }, isLikelyAudio: () => true }
  })('audioCache');
  const cache = new AudioCache({ globalStorageUri: { fsPath: dir } });
  cache.enqueue('voice', 'en-US', Array.from({ length: 6 }, (_, i) => ({ text: `private example ${i}` })));
  assert.equal(requests, 3);
  const cleared = cache.clear();
  cache.enqueue('voice', 'en-US', [{ text: 'another private example' }]);
  releases.forEach(fn => fn());
  await cleared;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 3);
  assert.deepEqual(fs.readdirSync(cache.dir), []);
  assert(!logs.join('\n').includes('private example'));
});

test('failed speech request logs omit text and remote error details', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-failure-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const logs = [];
  const { AudioCache } = loader({
    vscode: host(), './logger': { log: (...args) => logs.push(args.join(' ')) }, './edgeTts': {},
    './tts': { googleTts: async () => { throw new Error('remote echoed private text'); } }
  })('audioCache');
  const cache = new AudioCache({ globalStorageUri: { fsPath: dir } });
  await assert.rejects(cache.fetchAndStore('voice', 'en-US', 'private text'));
  assert(!logs.join('\n').includes('private text'));
  assert.equal(cache.stats.failed, 1);
});

test('progress sync is opt-in; reset persists an empty progress map', async () => {
  const settings = {};
  let keys, saved;
  const { WordStore } = loader({
    vscode: host(settings), './dictionary': { Dictionary: class {} }, './libraries': { LibraryRegistry: class {} }
  })('wordStore');
  const store = new WordStore({
    globalState: { get: () => ({ hello: { status: 'known' } }), setKeysForSync: value => { keys = value; }, update: async (_, value) => { saved = value; } }
  });
  assert.deepEqual(keys, []);
  settings.syncProgress = true;
  store.configureSync();
  assert.deepEqual(keys, ['vocab2code.progress']);
  await store.resetProgress();
  assert.deepEqual(saved, {});
  assert.deepEqual(store.getProgress(), {});
});

test('personal CSV/JSON examples survive import and dictionary resolution', () => {
  const load = loader({ vscode: host(), './logger': { log() {} } });
  const { parseWordFile } = load('importer');
  const { Dictionary } = load('dictionary');
  const lib = parseWordFile('word,definition,example,translation\nhello,你好,Hello there.,你好。', 'personal.csv', { accent: 'us' });
  const restored = parseWordFile(JSON.stringify(lib), 'personal.json', { accent: 'us' });
  const resolved = new Dictionary(() => []).resolve(restored.words);
  assert.equal(resolved[0].senses[0].examples[0].en, 'Hello there.');
  assert.equal(resolved[0].senses[0].examples[0].zh, '你好。');
});
