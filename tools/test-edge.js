// quick standalone test of edgeTts to verify Sec-MS-GEC works
const WebSocket = require('ws');
const { randomUUID, createHash } = require('crypto');

const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + TRUSTED;
const VER = '1-130.0.2849.68';
const WIN_EPOCH = 11644473600;
const TICKS_PS = 1e7;
const ROUND = 3e9;

function gec() {
  const u = Math.floor(Date.now() / 1000);
  let t = BigInt(u + WIN_EPOCH) * BigInt(TICKS_PS);
  t -= t % BigInt(ROUND);
  return createHash('sha256').update(t.toString() + TRUSTED).digest('hex').toUpperCase();
}

const text = process.argv[2] || 'hello world';
const voice = process.argv[3] || 'en-US-AriaNeural';
const lang = 'en-US';
const fullUrl = URL + '&Sec-MS-GEC=' + gec() + '&Sec-MS-GEC-Version=' + VER + '&ConnectionId=' + randomUUID().replace(/-/g, '');

const ws = new WebSocket(fullUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
  }
});

const t0 = Date.now();
let bytes = 0;

ws.on('open', () => {
  console.log('open in', Date.now() - t0, 'ms');
  const ts = new Date().toISOString();
  ws.send('X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
  const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" + lang + "'><voice name='" + voice + "'><prosody rate='-5%'>" + text + "</prosody></voice></speak>";
  ws.send('X-RequestId:' + randomUUID().replace(/-/g, '') + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + '\r\nPath:ssml\r\n\r\n' + ssml);
});
ws.on('message', (data, isBinary) => {
  if (isBinary) { bytes += data.length; }
  else {
    const s = data.toString();
    if (s.includes('Path:turn.end')) {
      console.log('done in', Date.now() - t0, 'ms, bytes=', bytes);
      ws.close();
    }
  }
});
ws.on('error', (e) => { console.error('ERR', Date.now() - t0, 'ms:', e.message); });
ws.on('close', (code) => { console.log('close code=', code, 'after', Date.now() - t0, 'ms'); });
