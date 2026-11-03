import * as vscode from 'vscode';
import { AudioCache, PrefetchItem } from './audioCache';
import { log } from './logger';
import { randomBytes } from 'crypto';

export class AudioPlayer {
  private panel: vscode.WebviewPanel | undefined;
  private cache: AudioCache;

  constructor(private context: vscode.ExtensionContext) {
    this.cache = new AudioCache(context);
  }

  private resolveVoice(): { voice: string; lang: string } {
    const cfg = vscode.workspace.getConfiguration('vocab2code');
    const accent = cfg.get<string>('audioAccent', 'us');
    const voiceCfg = cfg.get<string>('voice', 'auto');
    const voice = voiceCfg !== 'auto'
      ? voiceCfg
      : (accent === 'uk' ? 'en-GB-SoniaNeural' : 'en-US-AriaNeural');
    const lang = voice.startsWith('en-GB') ? 'en-GB' : 'en-US';
    return { voice, lang };
  }

  private ensurePanel(focus: boolean): vscode.WebviewPanel {
    if (this.panel) {
      if (focus) this.panel.reveal(undefined, false);
      return this.panel;
    }
    const cacheUri = vscode.Uri.file(this.cache.dir);
    this.panel = vscode.window.createWebviewPanel(
      'vocab2codeAudio',
      'core',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: !focus },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [cacheUri]
      }
    );
    this.panel.onDidDispose(() => { this.panel = undefined; }, null, this.context.subscriptions);
    this.panel.webview.html = this.html();
    return this.panel;
  }

  async play(text: string): Promise<void> {
    if (!text) return;
    const { voice, lang } = this.resolveVoice();
    const panel = this.ensurePanel(true);
    const post = (url: string, source: string) => {
      const send = () => panel.webview.postMessage({ type: 'play', url, text, source });
      // give a brand-new webview a beat to wire up its message listener
      setTimeout(send, 80);
    };

    if (this.cache.has(voice, text)) {
      log('play cache HIT');
      const filePath = this.cache.pathFor(voice, text);
      const url = panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
      post(url, 'cached');
      return;
    }

    log('play cache MISS, fetching');
    panel.webview.postMessage({ type: 'status', text: '// fetching audio…' });
    try {
      const filePath = await this.cache.fetchAndStore(voice, lang, text);
      const url = panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
      post(url, 'downloaded');
    } catch {
      panel.webview.postMessage({ type: 'status', text: '// audio unavailable; retry in 30s or run vocab2code: Show Log' });
    }
  }

  cacheStats() { return this.cache.stats; }

  prefetch(items: PrefetchItem[]): void {
    if (!vscode.workspace.getConfiguration('vocab2code').get<boolean>('audioPrefetch', false)) return;
    if (!items || items.length === 0) return;
    const { voice, lang } = this.resolveVoice();
    this.cache.enqueue(voice, lang, items);
  }

  stopPrefetch(): void { this.cache.stopPrefetch(); }

  async clearCache(): Promise<void> {
    this.panel?.dispose();
    await this.cache.clear();
  }

  dispose(): void {
    this.stopPrefetch();
    this.panel?.dispose();
  }

  private html(): string {
    const nonce = randomBytes(16).toString('hex');
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${this.panel!.webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
body{background:#1e1e1e;color:#d4d4d4;font-family:'Cascadia Code',Consolas,monospace;font-size:12px;padding:0;margin:0;}
.bar{padding:6px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#3a3a3a;flex-shrink:0;}
.dot.on{background:#4ec9b0;}
.msg{color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.info{color:#6a6a6a;font-size:11px;}
.btn{cursor:pointer;background:#2d2d2d;color:#4ec9b0;border:1px solid #3a3a3a;padding:4px 10px;border-radius:2px;font-family:inherit;font-size:11px;}
.btn:hover{background:#3a3a3a;}
.hidden{display:none;}
</style></head><body>
<div class="bar">
  <span id="dot" class="dot"></span>
  <span id="msg" class="msg">// ready</span>
  <button id="enable" class="btn hidden">enable()</button>
</div>
<div class="bar" style="padding-top:0;">
  <span class="info" id="info">// engine: pending</span>
</div>
<audio id="a" preload="auto"></audio>
<script nonce="${nonce}">
const dot = document.getElementById('dot');
const msg = document.getElementById('msg');
const info = document.getElementById('info');
const audioEl = document.getElementById('a');
const enableBtn = document.getElementById('enable');
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
let unlocked = false;
let pending = null;

function play(url, text, source) {
  info.textContent = '// engine: ' + source;
  audioEl.src = url;
  audioEl.play().then(() => {
    unlocked = true;
    dot.classList.add('on');
    msg.textContent = '// playing: ' + (text || '').slice(0, 80);
  }).catch(err => {
    dot.classList.remove('on');
    if (err && err.name === 'NotAllowedError') {
      pending = { url, text, source };
      enableBtn.classList.remove('hidden');
      msg.textContent = '// click enable() to unlock playback';
    } else {
      msg.textContent = '// play failed: ' + (err.message || 'unknown');
    }
  });
}

enableBtn.addEventListener('click', () => {
  audioEl.src = SILENT_WAV;
  audioEl.play().then(() => {
    unlocked = true;
    enableBtn.classList.add('hidden');
    msg.textContent = '// unlocked';
    if (pending) { const p = pending; pending = null; play(p.url, p.text, p.source); }
  }).catch(err => { msg.textContent = '// unlock failed: ' + (err.message || 'unknown'); });
});

audioEl.addEventListener('ended', () => { dot.classList.remove('on'); msg.textContent = '// idle'; });

window.addEventListener('message', e => {
  const m = e.data;
  if (m.type === 'play') play(m.url, m.text, m.source);
  else if (m.type === 'status' && m.text) msg.textContent = m.text;
});

// pre-warm unlock
audioEl.src = SILENT_WAV;
audioEl.play().then(() => { unlocked = true; info.textContent = '// engine: ready'; })
              .catch(() => { info.textContent = '// engine: pending unlock'; });
</script>
</body></html>`;
  }
}
