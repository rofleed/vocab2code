import * as vscode from 'vscode';
import { WordEntry, WordProgress } from './types';
import { WordStore } from './wordStore';
import { pickDaily, currentDateKey } from './dailyPicker';

export const SCHEME = 'vocab2code';
export const URI = vscode.Uri.parse(`${SCHEME}:/daily/module.ts`);

export interface RenderedExample {
  text: string;        // english sentence to TTS
  line: number;        // 0-based line where its const lives
}

export interface RenderedWord {
  entry: WordEntry;
  declarationLine: number; // 0-based line where `const word = phonetic(...)` lives
  examples: RenderedExample[];
}

export class DailyDocumentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private renderCache = new Map<string, RenderedWord[]>();

  constructor(private store: WordStore) {}

  getRenderedWords(uri: vscode.Uri): RenderedWord[] {
    return this.renderCache.get(uri.toString()) ?? [];
  }

  refresh(uri: vscode.Uri = URI): void {
    this._onDidChange.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const cfg = vscode.workspace.getConfiguration('vocab2code');
    const library = cfg.get<string>('library', 'ielts');
    const count = cfg.get<number>('dailyCount', 20);
    const cooldown = cfg.get<number>('knownCooldownDays', 7);

    let entries: WordEntry[];
    try {
      entries = this.store.loadLibrary(library);
    } catch {
      return `// failed to load library "${library}"\n`;
    }
    const progress = this.store.getProgress();
    const picked = pickDaily(entries, progress, {
      library,
      count,
      knownCooldownDays: cooldown
    });

    const lines: string[] = [];
    const rendered: RenderedWord[] = [];

    const stats = this.store.getStats(library);
    const pct = stats.total === 0 ? 0 : Math.round((stats.known / stats.total) * 100);
    const bar = this.progressBar(pct);

    lines.push(`// daily module — ${currentDateKey()} (${library})`);
    lines.push(`// progress: ${bar} ${stats.known}/${stats.total} done  •  ${stats.hard} hard  •  ${stats.remaining} remaining`);
    lines.push(`// today: ${picked.length} pushed (cooldown skips marked-known for ${cooldown}d)`);
    lines.push(`// ─────────────────────────────────────────────`);
    lines.push('');
    lines.push(`import { phonetic, sense } from "./core";`);
    lines.push('');

    for (let i = 0; i < picked.length; i++) {
      const w = picked[i];
      const mark = this.store.getMark(w.word);
      const ident = this.safeIdent(w.word);

      lines.push(`/**`);
      lines.push(` * #${String(i + 1).padStart(2, '0')}  ${w.word}  ${w.phonetic}${this.markBadge(mark)}`);
      lines.push(` */`);
      const declLine = lines.length;
      lines.push(`const ${ident} = phonetic("${w.phonetic}");`);

      const examples: RenderedExample[] = [];
      const hideEmpty = cfg.get<boolean>('hideEmptySenses', false);

      // When hideEmpty is on, keep every sense that has at least one example,
      // plus senses[0] (so the user always sees the primary meaning even if
      // the dictionary entry has no example for it). Words with no examples
      // at all (e.g. resolved from the dictionary) show every sense.
      const anyExamples = w.senses.some(s => s.examples.length > 0);
      const sensesToRender = hideEmpty && anyExamples
        ? w.senses.filter((s, i) => i === 0 || (s.examples && s.examples.length > 0))
        : w.senses;
      if (!sensesToRender.length) {
        lines.push('');
        lines.push('// (no definition)');
      }

      for (let si = 0; si < sensesToRender.length; si++) {
        const s = sensesToRender[si];
        lines.push('');
        const tag = s.pos ? `@${s.pos.replace(/\./g, '')}  ` : '';
        lines.push(`// ${tag}${s.definition}`);
        for (let ei = 0; ei < s.examples.length; ei++) {
          const ex = s.examples[ei];
          const key = `${ident}_s${si + 1}_e${ei + 1}`;
          const exLine = lines.length;
          lines.push(`const ${key} = sense("${this.escape(ex.en)}");`);
          if (ex.zh) lines.push(`//        ${ex.zh}`);
          examples.push({ text: ex.en, line: exLine });
        }
      }

      rendered.push({ entry: w, declarationLine: declLine, examples });
      lines.push('');
    }

    lines.push(`// end of module — run vocab2code.refresh to regenerate`);
    lines.push('');

    this.renderCache.set(uri.toString(), rendered);
    return lines.join('\n');
  }

  private markBadge(p: WordProgress | undefined): string {
    if (!p) return '';
    if (p.status === 'known') return '   // ✓ known';
    if (p.status === 'hard') return '   // ✗ hard';
    return '';
  }

  private safeIdent(word: string): string {
    return word.replace(/[^a-zA-Z0-9_$]/g, '_');
  }

  private escape(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private progressBar(pct: number): string {
    const width = 20;
    const filled = Math.round((pct / 100) * width);
    return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + `] ${pct}%`;
  }
}
