// Usage: node tools/translate-zh.js <library.json>
// Fills empty `zh` fields in examples via Google Translate's free endpoint.
// Resumable via .translate-cache.json next to the target.

const fs = require('fs');
const path = require('path');

const CONCURRENCY = 2;
const DELAY_MS = 120; // per-worker pacing

async function gtTranslate(text) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=' +
    encodeURIComponent(text);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!res.ok) throw new Error('http ' + res.status);
  const json = await res.json();
  if (!Array.isArray(json) || !Array.isArray(json[0])) throw new Error('bad response');
  return json[0].map(seg => seg[0] || '').join('').trim();
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tools/translate-zh.js <library.json>');
    process.exit(1);
  }
  const cachePath = path.join(path.dirname(file), '.translate-cache.json');
  let cache = {};
  if (fs.existsSync(cachePath)) {
    try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const queue = [];
  for (const entry of data) {
    if (!entry.senses) continue;
    for (const sense of entry.senses) {
      if (!sense.examples) continue;
      for (const ex of sense.examples) {
        if (!ex.en) continue;
        if (ex.zh && ex.zh.trim()) continue;
        if (cache[ex.en]) { ex.zh = cache[ex.en]; continue; }
        queue.push(ex);
      }
    }
  }
  console.log('to translate:', queue.length, '(cached', Object.keys(cache).length + ')');

  let idx = 0;
  let done = 0;
  let lastSave = Date.now();

  const saveAll = () => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  };

  async function worker(id) {
    while (idx < queue.length) {
      const ex = queue[idx++];
      try {
        const zh = await gtTranslate(ex.en);
        if (zh) {
          ex.zh = zh;
          cache[ex.en] = zh;
        }
      } catch (err) {
        console.error(`w${id} fail:`, JSON.stringify(ex.en.slice(0, 50)), err.message);
        await new Promise(r => setTimeout(r, 2000));
      }
      done++;
      if (done % 50 === 0) console.log(`progress: ${done}/${queue.length}`);
      if (Date.now() - lastSave > 5000) { saveAll(); lastSave = Date.now(); }
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  saveAll();
  console.log('done. total translated:', done);
}

main().catch(err => { console.error(err); process.exit(1); });
