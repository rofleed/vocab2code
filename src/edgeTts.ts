import WebSocket from 'ws';
import { randomUUID, createHash } from 'crypto';
import { log } from './logger';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_WS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + TRUSTED_CLIENT_TOKEN;
const SEC_MS_GEC_VERSION = '1-131.0.2903.86';
const WIN_EPOCH = 11644473600;
const TICKS_PER_SECOND = 1e7;
const ROUND_INTERVAL_TICKS = 3e9;

// adjusted via 403 responses that carry server time in the Date header
let clockSkewMs = 0;

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateSecMsGec(): string {
  const unixSeconds = Math.floor((Date.now() + clockSkewMs) / 1000);
  let ticks = BigInt(unixSeconds + WIN_EPOCH) * BigInt(TICKS_PER_SECOND);
  ticks -= ticks % BigInt(ROUND_INTERVAL_TICKS);
  const payload = ticks.toString() + TRUSTED_CLIENT_TOKEN;
  return createHash('sha256').update(payload).digest('hex').toUpperCase();
}

export interface EdgeTtsOptions {
  text: string;
  voice: string;
  lang: string;
  rate?: string;
  timeoutMs?: number;
}

export function edgeTts(opts: EdgeTtsOptions): Promise<Buffer> {
  return tryEdge(opts, false, Date.now() + (opts.timeoutMs ?? 8000));
}

function tryEdge(opts: EdgeTtsOptions, isRetry: boolean, deadline: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const secMsGec = generateSecMsGec();
    const url = EDGE_WS + '&Sec-MS-GEC=' + secMsGec + '&Sec-MS-GEC-Version=' + SEC_MS_GEC_VERSION + '&ConnectionId=' + randomUUID().replace(/-/g, '');
    const ws = new WebSocket(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const chunks: Buffer[] = [];
    let done = false;
    const fail = (err: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.terminate(); } catch {}
      reject(err);
    };
    const timer = setTimeout(() => fail(new Error('timeout')), Math.max(1, deadline - Date.now()));

    ws.on('unexpected-response', (_req, res) => {
      const status = res.statusCode ?? 0;
      const dateStr = res.headers?.date;
      if (status === 403 && !isRetry && dateStr) {
        const serverMs = new Date(dateStr).getTime();
        if (!isNaN(serverMs)) {
          const newSkewMs = serverMs - Date.now();
          if (Math.abs(newSkewMs - clockSkewMs) > 500) {
            log('edge clock skew adjusted', `${Math.round(newSkewMs)}ms`, `(was ${Math.round(clockSkewMs)}ms)`);
            clockSkewMs = newSkewMs;
          }
          done = true;
          clearTimeout(timer);
          try { ws.terminate(); } catch {}
          tryEdge(opts, true, deadline).then(resolve).catch(reject);
          return;
        }
      }
      fail(new Error('http ' + status));
    });

    ws.on('open', () => {
      const ts = new Date().toISOString();
      const cfg =
        'X-Timestamp:' + ts + '\r\n' +
        'Content-Type:application/json; charset=utf-8\r\n' +
        'Path:speech.config\r\n\r\n' +
        '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}';
      ws.send(cfg);
      const rate = opts.rate ?? '-5%';
      const ssml =
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" + opts.lang + "'>" +
        "<voice name='" + opts.voice + "'><prosody rate='" + rate + "'>" + xmlEsc(opts.text) + "</prosody></voice></speak>";
      const req =
        'X-RequestId:' + randomUUID().replace(/-/g, '') + '\r\n' +
        'Content-Type:application/ssml+xml\r\n' +
        'X-Timestamp:' + ts + '\r\n' +
        'Path:ssml\r\n\r\n' + ssml;
      ws.send(req);
    });

    ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      if (!isBinary) {
        const s = data.toString();
        if (s.indexOf('Path:turn.end') >= 0) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { ws.close(); } catch {}
          if (chunks.length === 0) { reject(new Error('no audio received')); return; }
          resolve(Buffer.concat(chunks));
        }
      } else {
        const buf = data as Buffer;
        if (buf.length < 2) return;
        const headerLen = buf.readUInt16BE(0);
        if (buf.length > 2 + headerLen) chunks.push(buf.subarray(2 + headerLen));
      }
    });

    ws.on('error', (err) => fail(err instanceof Error ? err : new Error(String(err))));
    ws.on('close', (code) => { if (!done) fail(new Error('ws closed ' + code)); });
  });
}
