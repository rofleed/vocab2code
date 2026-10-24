import * as fs from 'fs';
import * as path from 'path';
import { LibraryFile, LibraryInfo, LibraryMeta, LibraryOrigin, LibraryWord, WordEntry } from './types';
import type { Dictionary } from './dictionary';
import { log } from './logger';

export interface LibrarySource {
  dir: string;
  origin: LibraryOrigin;
}

interface CachedFile {
  mtimeMs: number;
  size: number;
  file: LibraryFile;
}

// Parses library files from several directories. Later sources override
// earlier ones on id collision, so users can shadow a builtin library.
export class LibraryRegistry {
  private cache = new Map<string, CachedFile>();

  constructor(
    private sources: () => LibrarySource[],
    private dictionary: Dictionary
  ) {}

  list(): LibraryInfo[] {
    const byId = new Map<string, LibraryInfo>();
    for (const src of this.sources()) {
      for (const file of listJsonFiles(src.dir)) {
        try {
          const lib = this.read(file);
          if (!lib.words.length) {
            log('library skipped: no valid entries');
            continue;
          }
          byId.set(lib.meta.id, {
            meta: lib.meta,
            count: lib.words.length,
            origin: src.origin,
            path: file
          });
        } catch (e) {
          log('library skipped: invalid or unreadable data');
        }
      }
    }
    return [...byId.values()].sort((a, b) => a.meta.id.localeCompare(b.meta.id));
  }

  find(id: string): LibraryInfo | undefined {
    return this.list().find(l => l.meta.id === id);
  }

  load(id: string): WordEntry[] {
    const info = this.find(id);
    if (!info) throw new Error(`Library not found: ${id}`);
    return this.dictionary.resolve(this.read(info.path).words);
  }

  private read(file: string): LibraryFile {
    const stat = fs.statSync(file);
    const hit = this.cache.get(file);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.file;

    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const lib = parseLibrary(raw, path.basename(file, path.extname(file)));
    this.cache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, file: lib });
    return lib;
  }
}

// `dir` may also point directly at a single .json file.
export function listJsonFiles(dir: string): string[] {
  let names: string[];
  try {
    if (fs.statSync(dir).isFile()) return [dir];
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter(n => !n.startsWith('.') && n.toLowerCase().endsWith('.json'))
    .map(n => path.join(dir, n));
}

export function parseLibrary(raw: unknown, fallbackId: string): LibraryFile {
  let metaRaw: Partial<LibraryMeta> = {};
  let wordsRaw: unknown;

  if (Array.isArray(raw)) {
    // legacy (schema 0): bare WordEntry[]
    wordsRaw = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as any).words)) {
    metaRaw = (raw as any).meta ?? {};
    wordsRaw = (raw as any).words;
  } else {
    throw new Error('expected a word array or { meta, words }');
  }

  const id = typeof metaRaw.id === 'string' && metaRaw.id.trim() ? metaRaw.id.trim() : fallbackId;
  const meta: LibraryMeta = {
    ...metaRaw,
    id,
    name: typeof metaRaw.name === 'string' && metaRaw.name ? metaRaw.name : id,
    schema: typeof metaRaw.schema === 'number' ? metaRaw.schema : 0
  };

  const words: LibraryWord[] = [];
  let dropped = 0;
  for (const w of wordsRaw as unknown[]) {
    const entry = normalizeEntry(w);
    if (entry) words.push(entry);
    else dropped++;
  }
  if (dropped) log('library', `dropped ${dropped} malformed entries`);
  return { meta, words };
}

function normalizeEntry(w: any): LibraryWord | undefined {
  if (typeof w === 'string') return w.trim() || undefined;
  if (!w || typeof w.word !== 'string' || !w.word.trim()) return undefined;
  const senses = Array.isArray(w.senses) ? w.senses : [];
  return {
    word: w.word,
    phonetic: typeof w.phonetic === 'string' ? w.phonetic : '',
    senses: senses
      .filter((s: any) => s && typeof s.definition === 'string')
      .map((s: any) => ({
        pos: typeof s.pos === 'string' ? s.pos : '',
        definition: s.definition,
        examples: Array.isArray(s.examples)
          ? s.examples.filter((ex: any) => ex && typeof ex.en === 'string')
          : []
      }))
  };
}
