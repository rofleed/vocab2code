import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { edgeTts } from './edgeTts';
import { googleTts, youdaoTts, isLikelyAudio } from './tts';
import { log } from './logger';

type Engine = 'edge' | 'google';

function currentEngine(): Engine {
  const v = vscode.workspace.getConfiguration('vocab2code').get<string>('engine', 'google');
  return v === 'edge' ? 'edge' : 'google';
}

function isWord(text: string): boolean {
  return text.length <= 40 && !/\s/.test(text);
}

function mapVoiceForEngine(engine: Engine, voice: string, lang: string): string {
  if (engine === 'edge') {
    if (voice.includes('Neural')) return voice;
    return lang === 'en-GB' ? 'en-GB-SoniaNeural' : 'en-US-AriaNeural';
  }
  return voice; // google ignores voice
}

async function invokeTts(engine: Engine, voice: string, lang: string, text: string): Promise<Buffer> {
  const v = mapVoiceForEngine(engine, voice, lang);
  if (engine === 'edge') return edgeTts({ text, voice: v, lang });
  return googleTts(text, lang === 'en-GB' ? 'co.uk' : 'com');
}

// Fallback chain. Youdao for words only (it 500s on full sentences and costs
// ~500ms per failed attempt). Sentences go straight to the engine chain.
async function fetchWithFallback(voice: string, lang: string, text: string): Promise<{ buf: Buffer; engine: string }> {
  if (isWord(text)) {
    try {
      const buf = await youdaoTts(text, lang === 'en-GB' ? 'uk' : 'us');
      if (isLikelyAudio(buf)) return { buf, engine: 'youdao' };
      log('youdao non-audio', `${buf.byteLength}B`);
    } catch (err) {
      log('youdao fail');
    }
  }
  const primary = currentEngine();
  const chain: Engine[] = primary === 'google' ? ['google'] : ['edge', 'google'];
  let lastErr: unknown = new Error('no engine tried');
  for (const e of chain) {
    try {
      const buf = await invokeTts(e, voice, lang, text);
      if (!isLikelyAudio(buf)) {
        log('engine non-audio', e, `${buf.byteLength}B`);
        lastErr = new Error(e + ' returned non-audio');
        continue;
      }
      return { buf, engine: e };
    } catch (err) {
      lastErr = err;
      log('engine fail', e);
    }
  }
  throw lastErr;
}

export interface PrefetchItem { text: string; }

export class AudioCache {
  private cacheDir: string;
  private inflight = new Map<string, Promise<string>>();
  private queue: { text: string; voice: string; lang: string }[] = [];
  private active = 0;
  private clearing: Promise<void> | undefined;
  private readonly concurrency = 3;
  stats = { cached: 0, fetched: 0, failed: 0 };

  constructor(context: vscode.ExtensionContext) {
    this.cacheDir = path.join(context.globalStorageUri.fsPath, 'audio');
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  get dir(): string { return this.cacheDir; }

  private keyFor(voice: string, text: string): string {
    const h = createHash('sha1').update(voice + '|' + text).digest('hex');
    return h + '.mp3';
  }

  pathFor(voice: string, text: string): string {
    return path.join(this.cacheDir, this.keyFor(voice, text));
  }

  has(voice: string, text: string): boolean {
    try {
      const p = this.pathFor(voice, text);
      const st = fs.statSync(p);
      return st.isFile() && st.size > 0;
    } catch {
      return false;
    }
  }

  // Fetch + persist. Dedupes concurrent requests for the same key.
  fetchAndStore(voice: string, lang: string, text: string): Promise<string> {
    if (this.clearing) return Promise.reject(new Error('Audio cache is being cleared. Try again.'));
    const p = this.pathFor(voice, text);
    if (this.has(voice, text)) { this.stats.cached++; return Promise.resolve(p); }
    const key = voice + '|' + text;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const t0 = Date.now();
    const job = (async () => {
      const { buf, engine } = await fetchWithFallback(voice, lang, text);
      fs.writeFileSync(p, buf);
      const dt = Date.now() - t0;
      this.stats.fetched++;
      log('fetch ok', engine, `${dt}ms`, `${buf.byteLength}B`, voice);
      return p;
    })().catch(err => {
      const dt = Date.now() - t0;
      this.stats.failed++;
      log('fetch FAIL all', `${dt}ms`, voice);
      throw err;
    }).finally(() => { this.inflight.delete(key); });
    this.inflight.set(key, job);
    return job;
  }

  // Background prefetch. Skips already-cached. Queue is processed at `concurrency`.
  enqueue(voice: string, lang: string, items: PrefetchItem[]): void {
    if (this.clearing) return;
    let added = 0;
    let already = 0;
    for (const it of items) {
      if (!it || !it.text) continue;
      if (this.has(voice, it.text)) { already++; continue; }
      if (this.inflight.has(voice + '|' + it.text)) { already++; continue; }
      if (this.queue.find(q => q.voice === voice && q.text === it.text)) { already++; continue; }
      this.queue.push({ text: it.text, voice, lang });
      added++;
    }
    log('prefetch enqueue', `+${added} new`, `${already} skipped`, `queue=${this.queue.length}`, `voice=${voice}`);
    this.tick();
  }

  private tick(): void {
    if (this.clearing) return;
    while (this.active < this.concurrency && this.queue.length) {
      const item = this.queue.shift()!;
      if (this.has(item.voice, item.text)) continue;
      this.active++;
      this.fetchAndStore(item.voice, item.lang, item.text)
        .catch(() => {})
        .finally(() => { this.active--; this.tick(); });
    }
  }

  get queueSize(): number { return this.queue.length + this.active; }

  stopPrefetch(): void { this.queue = []; }

  clear(): Promise<void> {
    if (this.clearing) return this.clearing;
    this.stopPrefetch();
    this.clearing = (async () => {
      await Promise.allSettled([...this.inflight.values()]);
      // Delete only cache files owned by this extension.
      for (const name of fs.readdirSync(this.cacheDir)) {
        if (/^[a-f0-9]{40}\.mp3$/.test(name)) fs.unlinkSync(path.join(this.cacheDir, name));
      }
      this.stats = { cached: 0, fetched: 0, failed: 0 };
    })().finally(() => { this.clearing = undefined; });
    return this.clearing;
  }
}
