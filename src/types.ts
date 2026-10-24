export interface Example {
  en: string;
  zh?: string;
}

export interface Sense {
  pos: string;
  definition: string;
  examples: Example[];
}

export interface WordEntry {
  word: string;
  phonetic: string;
  senses: Sense[];
}

// Header of a library file (schema >= 1). Legacy files are a bare WordEntry[]
// and get a meta synthesized from their file name.
export interface LibraryMeta {
  id: string;
  name: string;
  description?: string;
  version?: string;
  schema: number;
  lang?: string;     // language being learned, e.g. "en"
  defLang?: string;  // language of definitions / translations, e.g. "zh-CN"
  count?: number;
  license?: string;
  source?: string;
}

// A plain string is a bare word resolved through the dictionary at load time.
// An object entry is used as-is, with blanks (phonetic, definitions) filled
// from the dictionary.
export type LibraryWord = string | WordEntry;

export interface LibraryFile {
  meta: LibraryMeta;
  words: LibraryWord[];
}

export interface DictEntry {
  phonetic: string;
  senses: Sense[];
  examples: Example[]; // word-level; attached to the first sense when resolved
}

export type LibraryOrigin = 'builtin' | 'user' | 'custom';

export interface LibraryInfo {
  meta: LibraryMeta;
  count: number;
  origin: LibraryOrigin;
  path: string;
}

export type MarkStatus = 'known' | 'hard' | 'new';

export interface WordProgress {
  status: MarkStatus;
  updatedAt: number; // epoch ms
  seenCount: number;
}

// Keyed by wordKey(word); shared across all libraries.
export type ProgressMap = Record<string, WordProgress>;

export function wordKey(word: string): string {
  return word.trim().toLowerCase();
}
