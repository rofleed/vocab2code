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
    return Buffer.from(await res.arrayBuffer());
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

// Google Translate TTS — robotic but extremely reliable.
export async function googleTts(text: string, tld: string): Promise<Buffer> {
  const t = text.length > 200 ? text.slice(0, 200) : text;
  const url = `https://translate.google.${tld}/translate_tts?ie=UTF-8&q=${encodeURIComponent(t)}&tl=en&client=tw-ob`;
  return fetchBuffer(url);
}

// Youdao dictvoice — fast in China, real-voice recordings for common words,
// synthesized for the rest. Only reliable for single words/short phrases.
export async function youdaoTts(text: string, accent: 'us' | 'uk'): Promise<Buffer> {
  const type = accent === 'uk' ? 1 : 2;
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`;
  return fetchBuffer(url, 4000);
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
