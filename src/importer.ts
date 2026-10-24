import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LibraryFile, LibraryMeta, LibraryWord, WordEntry, wordKey } from './types';
import { unzipSync, strFromU8 } from 'fflate';
import { parseLibrary } from './libraries';
import { WordStore } from './wordStore';

const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;

export interface ParseOptions {
  accent: 'us' | 'uk'; // which phonetic to keep when a source has both
}

// Reads a word file from disk; a .zip is unpacked and every .json inside is
// imported into one library (kajweb/dict ships each book as a zip).
export function readWordFile(file: string, opts: ParseOptions): LibraryFile {
  if (path.extname(file).toLowerCase() !== '.zip') {
    return parseWordFile(fs.readFileSync(file, 'utf8'), file, opts);
  }
  const files = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const jsons = Object.keys(files).filter(n => n.toLowerCase().endsWith('.json')).sort();
  if (!jsons.length) throw new Error('no .json file in zip');
  const parts = jsons.map(n => parseWordFile(strFromU8(files[n]), n, opts));
  const first = parts[0];
  const base = path.basename(file, path.extname(file)).replace(/^\d+_/, '');
  const meta = parts.length === 1 ? first.meta : { ...first.meta, id: toId(base), name: base };
  return dedupe({ meta, words: parts.flatMap(p => p.words) });
}

// Turns a .txt / .csv / .tsv / .json file into library words.
//   .txt        one word or phrase per line; blank lines and `#` comments ignored
//   .csv / .tsv columns: word, definition, example, translation — or any order
//               with a header row naming them (also: phonetic, pos)
//   .json       an vocab2code library (or legacy bare array), or a
//               kajweb/dict book (one JSON object per line)
export function parseWordFile(text: string, file: string, opts: ParseOptions): LibraryFile {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, path.extname(file));
  text = text.replace(/^﻿/, '');

  let words: LibraryWord[];
  let meta: Partial<LibraryMeta> = {};
  const kajweb = ext === '.json' ? parseKajweb(text, opts) : undefined;
  if (kajweb) {
    words = kajweb.words;
    meta = { name: kajweb.bookId ?? base, id: toId(kajweb.bookId ?? base), source: `kajweb/dict ${kajweb.bookId ?? base}` };
  } else if (ext === '.json') {
    const lib = parseLibrary(JSON.parse(text), base);
    words = lib.words;
    meta = lib.meta;
  } else if (ext === '.csv' || ext === '.tsv') {
    words = fromRows(parseDelimited(text, ext === '.tsv' ? '\t' : ','));
  } else {
    words = text
      .split(/\r?\n/)
      .map(l => l.replace(/#.*/, '').trim())
      .filter(Boolean);
  }

  return dedupe({ meta: { ...meta, id: meta.id ?? toId(base), name: meta.name ?? base, schema: 1 }, words });
}

function dedupe(lib: LibraryFile): LibraryFile {
  const seen = new Set<string>();
  const words = lib.words.filter(w => {
    const k = wordKey(typeof w === 'string' ? w : w.word);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ...lib, words };
}

// kajweb/dict (https://github.com/kajweb/dict) book: one object per line,
// { headWord, content: { word: { content: { usphone, ukphone, trans, sentence } } }, bookId }.
// Returns undefined when the text is not in that format.
function parseKajweb(text: string, opts: ParseOptions): { words: WordEntry[]; bookId?: string } | undefined {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const parse = (l: string) => {
    try {
      return JSON.parse(l);
    } catch {
      return undefined;
    }
  };
  const first = parse(lines[0] ?? '');
  if (!first || typeof first.headWord !== 'string' || !first.content?.word) return undefined;

  const words: WordEntry[] = [];
  for (const line of lines) {
    const o = parse(line);
    const word = typeof o?.headWord === 'string' ? o.headWord.trim() : '';
    if (!word) continue;
    const c = o.content?.word?.content ?? {};
    const phones = opts.accent === 'uk'
      ? [c.ukphone, c.usphone, c.phone]
      : [c.usphone, c.ukphone, c.phone];
    const phone = phones.find(p => typeof p === 'string' && p.trim())?.trim();
    const examples = (c.sentence?.sentences ?? [])
      .filter((s: any) => typeof s?.sContent === 'string' && s.sContent.trim())
      .map((s: any) => (s.sCn ? { en: s.sContent.trim(), zh: String(s.sCn).trim() } : { en: s.sContent.trim() }));
    const senses = (c.trans ?? [])
      .filter((t: any) => typeof t?.tranCn === 'string' && t.tranCn.trim())
      .map((t: any) => ({ pos: kajwebPos(t.pos), definition: t.tranCn.trim(), examples: [] as { en: string; zh?: string }[] }));
    if (senses.length) senses[0].examples = examples;
    words.push({ word, phonetic: phone ? `/${phone}/` : '', senses });
  }
  return { words, bookId: typeof first.bookId === 'string' ? first.bookId : undefined };
}

// "v & n" / "n&v" / "a" -> "v./n." / "n./v." / "adj."
function kajwebPos(pos: unknown): string {
  if (typeof pos !== 'string' || !pos.trim()) return '';
  return pos
    .split('&')
    .map(p => p.trim().replace(/\.$/, ''))
    .filter(Boolean)
    .map(p => (p === 'a' ? 'adj' : p) + '.')
    .join('/');
}

const COLUMNS = ['word', 'phonetic', 'pos', 'definition', 'example', 'translation'] as const;
type Column = typeof COLUMNS[number];

function fromRows(rows: string[][]): LibraryWord[] {
  if (!rows.length) return [];
  let index: Partial<Record<Column, number>> = { word: 0, definition: 1, example: 2, translation: 3 };
  const header = rows[0].map(h => h.trim().toLowerCase());
  if (header.includes('word')) {
    index = {};
    for (const c of COLUMNS) {
      const i = header.indexOf(c);
      if (i >= 0) index[c] = i;
    }
    rows = rows.slice(1);
  }
  const col = (r: string[], c: Column) => (index[c] === undefined ? '' : (r[index[c]!] ?? '').trim());

  const out: LibraryWord[] = [];
  for (const r of rows) {
    const word = col(r, 'word');
    if (!word) continue;
    const definition = col(r, 'definition');
    const example = col(r, 'example');
    const phonetic = col(r, 'phonetic');
    if (!definition && !example && !phonetic) {
      out.push(word);
      continue;
    }
    const translation = col(r, 'translation');
    const entry: WordEntry = {
      word,
      phonetic,
      senses: [{
        pos: col(r, 'pos'),
        definition,
        examples: example ? [translation ? { en: example, zh: translation } : { en: example }] : []
      }]
    };
    out.push(entry);
  }
  return out;
}

function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"' && field === '') inQuotes = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim()));
}

function toId(name: string): string {
  const id = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+|-+$/g, '');
  return id || 'my-words';
}

// Interactive import into the user library folder. Returns the new id if the
// user asked to switch to it.
export async function importLibrary(store: WordStore): Promise<string | undefined> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Import',
    filters: { 'Word lists': ['txt', 'csv', 'tsv', 'json', 'zip'] }
  });
  if (!picked?.length) return;
  const file = picked[0].fsPath;
  const accent = vscode.workspace.getConfiguration('vocab2code').get<string>('audioAccent', 'us') === 'uk' ? 'uk' : 'us';

  let lib: LibraryFile;
  try {
    lib = readWordFile(file, { accent });
  } catch (e) {
    vscode.window.showErrorMessage(`vocab2code: cannot read ${path.basename(file)}: ${e}`);
    return;
  }
  if (!lib.words.length) {
    vscode.window.showErrorMessage(`vocab2code: no words found in ${path.basename(file)}.`);
    return;
  }

  const id = await vscode.window.showInputBox({
    prompt: `Library id for ${lib.words.length} words`,
    value: ID_RE.test(lib.meta.id) ? lib.meta.id : toId(lib.meta.id),
    validateInput: v => (ID_RE.test(v) ? undefined : 'lowercase letters, digits, ".", "_" and "-"')
  });
  if (!id) return;

  const existing = store.listLibraries().find(l => l.meta.id === id);
  if (existing) {
    const note = existing.origin === 'builtin'
      ? `"${id}" is a bundled library; the imported one will take its place.`
      : `Library "${id}" already exists (${existing.origin}). Replace it?`;
    const ok = await vscode.window.showWarningMessage(note, { modal: true }, 'Replace');
    if (ok !== 'Replace') return;
  }

  const out: LibraryFile = {
    meta: { ...lib.meta, id, count: lib.words.length, source: lib.meta.source ?? path.basename(file) },
    words: lib.words
  };
  const target = existing?.origin === 'user' ? existing.path : path.join(store.userLibraryDir, `${id}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(out, null, 2), 'utf8');

  const missing = store.loadLibrary(id).filter(w => !w.senses.some(s => s.definition.trim())).length;
  const msg = `vocab2code: imported ${out.words.length} words into "${id}"` +
    (missing ? `; ${missing} have no definition (not in dictionary).` : '.');
  const action = await vscode.window.showInformationMessage(msg, 'Switch to it');
  return action ? id : undefined;
}
