import * as fs from 'fs';
import { DictEntry, Example, LibraryWord, Sense, WordEntry, wordKey } from './types';
import { listJsonFiles } from './libraries';
import { log } from './logger';

// Shared word -> definition lookup used to resolve string entries in
// libraries. Files look like { meta, entries: { "<word>": DictEntry } };
// later directories override earlier ones per word.
export class Dictionary {
  private entries = new Map<string, DictEntry>();
  private signature = '';

  constructor(private dirs: () => string[]) {}

  resolve(words: LibraryWord[]): WordEntry[] {
    this.ensureLoaded();
    return words.map(w => this.fill(w));
  }

  private fill(w: LibraryWord): WordEntry {
    if (typeof w === 'string') {
      const d = this.entries.get(wordKey(w));
      return { word: w, phonetic: d?.phonetic ?? '', senses: d ? withExamples(cloneSenses(d.senses), d.examples) : [] };
    }
    const hasDefinition = w.senses.some(s => s.definition.trim());
    const hasExamples = w.senses.some(s => s.examples.length);
    if (w.phonetic && hasDefinition && hasExamples) return w;
    const d = this.entries.get(wordKey(w.word));
    if (!d) return w;
    let senses = w.senses;
    if (!hasDefinition && d.senses.length) {
      // keep the entry's own examples, attached to the dictionary's first sense
      senses = withExamples(cloneSenses(d.senses), w.senses.flatMap(s => s.examples));
    }
    if (!hasExamples && senses.length) {
      senses = withExamples(cloneSenses(senses), d.examples);
    }
    return { word: w.word, phonetic: w.phonetic || d.phonetic, senses };
  }

  private ensureLoaded(): void {
    const files = this.dirs().flatMap(listJsonFiles);
    const stats = files.map(f => {
      try {
        const s = fs.statSync(f);
        return `${f}:${s.mtimeMs}:${s.size}`;
      } catch {
        return `${f}:missing`;
      }
    });
    const signature = stats.join('|');
    if (signature === this.signature) return;

    this.entries.clear();
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        const entries = raw?.entries;
        if (!entries || typeof entries !== 'object') throw new Error('missing "entries" object');
        let n = 0;
        for (const [word, e] of Object.entries<any>(entries)) {
          if (!e || !Array.isArray(e.senses)) continue;
          this.entries.set(wordKey(word), {
            phonetic: typeof e.phonetic === 'string' ? e.phonetic : '',
            senses: e.senses
              .filter((s: any) => s && typeof s.definition === 'string')
              .map((s: any) => ({ pos: typeof s.pos === 'string' ? s.pos : '', definition: s.definition, examples: [] })),
            examples: Array.isArray(e.examples)
              ? e.examples.filter((ex: any) => ex && typeof ex.en === 'string')
              : []
          });
          n++;
        }
        log('dictionary loaded', `${n} entries`);
      } catch (e) {
        log('dictionary skipped: invalid or unreadable data');
      }
    }
    this.signature = signature;
  }
}

function cloneSenses(senses: Sense[]): Sense[] {
  return senses.map(s => ({ ...s, examples: [...s.examples] }));
}

// Puts word-level examples on the first sense (sources rarely say which sense
// an example belongs to). `senses` must already be a private copy.
function withExamples(senses: Sense[], examples: Example[]): Sense[] {
  if (senses.length && examples.length) senses[0].examples = [...examples];
  return senses;
}
