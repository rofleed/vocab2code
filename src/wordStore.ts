import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { WordEntry, ProgressMap, WordProgress, MarkStatus, LibraryInfo, wordKey } from './types';
import { LibraryRegistry, LibrarySource } from './libraries';
import { Dictionary } from './dictionary';

const PROGRESS_KEY = 'vocab2code.progress';

export class WordStore {
  private registry: LibraryRegistry;
  private progress: ProgressMap;

  constructor(
    private context: vscode.ExtensionContext
  ) {
    const dictionary = new Dictionary(() => [
      path.join(this.context.extensionPath, 'dict'),
      this.userDictionaryDir
    ]);
    this.registry = new LibraryRegistry(() => this.sources(), dictionary);
    this.progress = this.context.globalState.get<ProgressMap>(PROGRESS_KEY) ?? {};
    this.configureSync();
  }

  configureSync(): void {
    const enabled = vscode.workspace.getConfiguration('vocab2code').get<boolean>('syncProgress', false);
    this.context.globalState.setKeysForSync(enabled ? [PROGRESS_KEY] : []);
  }

  async resetProgress(): Promise<void> {
    this.progress = {};
    await this.context.globalState.update(PROGRESS_KEY, this.progress);
  }

  get userLibraryDir(): string {
    return path.join(this.context.globalStorageUri.fsPath, 'libraries');
  }

  get userDictionaryDir(): string {
    return path.join(this.context.globalStorageUri.fsPath, 'dictionaries');
  }

  private sources(): LibrarySource[] {
    const custom = vscode.workspace.getConfiguration('vocab2code').get<string[]>('libraryPaths', []);
    return [
      { dir: path.join(this.context.extensionPath, 'data'), origin: 'builtin' },
      { dir: this.userLibraryDir, origin: 'user' },
      ...custom.map(p => ({ dir: expandHome(p), origin: 'custom' as const }))
    ];
  }

  listLibraries(): LibraryInfo[] {
    return this.registry.list();
  }

  loadLibrary(id: string): WordEntry[] {
    return this.registry.load(id);
  }

  getProgress(): ProgressMap {
    return this.progress;
  }

  async setMark(word: string, status: MarkStatus): Promise<void> {
    const k = wordKey(word);
    const prev = this.progress[k];
    this.progress[k] = {
      status,
      updatedAt: Date.now(),
      seenCount: (prev?.seenCount ?? 0) + 1
    };
    await this.context.globalState.update(PROGRESS_KEY, this.progress);
  }

  async unmark(word: string): Promise<void> {
    delete this.progress[wordKey(word)];
    await this.context.globalState.update(PROGRESS_KEY, this.progress);
  }

  getMark(word: string): WordProgress | undefined {
    return this.progress[wordKey(word)];
  }

  getStats(library: string): { total: number; known: number; hard: number; remaining: number } {
    const entries = this.loadLibrary(library);
    let known = 0;
    let hard = 0;
    for (const e of entries) {
      const p = this.getMark(e.word);
      if (!p) continue;
      if (p.status === 'known') known++;
      else if (p.status === 'hard') hard++;
    }
    return { total: entries.length, known, hard, remaining: entries.length - known };
  }
}

function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}
