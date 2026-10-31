// Node-side TTS clients that don't require auth.

async function fetchBuffer(url: string, timeoutMs = 6000): Promise<Buffer> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.5'
      }
    });
    if (!res.ok) throw new Error('http ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isLikelyAudio(buf)) throw new Error('non-audio response');
    return buf;
  } finally {
    clearTimeout(t);
  }
}

// Streamelements proxies AWS Polly standard voices. Free, no auth, decent quality.
// Voices: Brian, Amy, Emma, Russell, Nicole, Joey, Joanna, Matthew, Salli,
// Justin, Kendra, Kimberly, Ivy.
export async function streamelementsTts(text: string, voice: string): Promise<Buffer> {
  const t = text.length > 240 ? text.slice(0, 240) : text;
  const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(t)}`;
  return fetchBuffer(url);
}

// Keep full sentences: these unofficial endpoints have short request limits.
// Split at whitespace when possible, without dropping any input characters.
function splitText(text: string, limit = 180): string[] {
  const chars = Array.from(text);
  const chunks: string[] = [];
  while (chars.length > limit) {
    let end = limit;
    for (let i = limit - 1; i > limit / 2; i--) {
      if (/\s/.test(chars[i])) { end = i + 1; break; }
    }
    chunks.push(chars.splice(0, end).join(''));
  }
  if (chars.length) chunks.push(chars.join(''));
  return chunks;
}

// Baidu Translate supports sentences as well as US/UK pronunciation.
// Use HTTPS directly; no third-party relay or API key is involved.
export async function baiduTts(text: string, accent: 'us' | 'uk'): Promise<Buffer> {
  const lang = accent === 'uk' ? 'uk' : 'en';
  const chunks: Buffer[] = [];
  for (const part of splitText(text)) {
    const url = `https://fanyi.baidu.com/gettts?lan=${lang}&text=${encodeURIComponent(part)}&spd=3&source=web`;
    chunks.push(await fetchBuffer(url, 4000));
  }
  return Buffer.concat(chunks);
}

// Google Translate is a fallback; it may be unreachable in mainland China.
export async function googleTts(text: string, tld: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for (const part of splitText(text)) {
    const url = `https://translate.google.${tld}/translate_tts?ie=UTF-8&q=${encodeURIComponent(part)}&tl=en&client=tw-ob`;
    chunks.push(await fetchBuffer(url, 4000));
  }
  return Buffer.concat(chunks);
}

// Youdao dictvoice — fast in China, real-voice recordings for common words,
// synthesized for the rest. Only reliable for single words/short phrases.
export async function youdaoTts(text: string, accent: 'us' | 'uk'): Promise<Buffer> {
  const type = accent === 'uk' ? 1 : 2;
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`;
  return fetchBuffer(url, 4000);
}

// Log only known categories, never URLs, response bodies or raw error messages
// (remote errors can echo the vocabulary text).
export function ttsFailureReason(err: unknown): string {
  if (!(err instanceof Error)) return 'request failed';
  if (err.name === 'AbortError' || err.message === 'timeout') return 'timeout';
  const http = /^http (\d{3})$/.exec(err.message);
  if (http) return 'http ' + http[1];
  if (err.message === 'non-audio response') return 'invalid audio';
  const cause = (err as Error & { cause?: NodeJS.ErrnoException }).cause;
  const code = (err as NodeJS.ErrnoException).code ?? cause?.code;
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code ?? '')) return 'DNS lookup failed';
  if (['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code ?? '')) return 'connection timeout';
  if (['ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code ?? '')) return 'connection failed';
  return 'request failed';
}

// Detect whether the bytes look like real audio (MP3 frame or ID3 header)
// vs. an HTML/JSON error page silently returned by the server.
export function isLikelyAudio(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // MP3 frame sync: 11 bits all 1
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  // ID3 tag
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  // OGG / WAV magic — possible too
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  return false;
}
