import * as vscode from 'vscode';
import { DailyDocumentProvider, SCHEME } from './viewProvider';
import { WordStore } from './wordStore';

export class DailyCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  constructor(
    private provider: DailyDocumentProvider,
    private store: WordStore
  ) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.uri.scheme !== SCHEME) return [];
    const rendered = this.provider.getRenderedWords(document.uri);
    const lenses: vscode.CodeLens[] = [];

    for (const r of rendered) {
      const line = r.declarationLine;
      if (line >= document.lineCount) continue;
      const range = new vscode.Range(line, 0, line, 0);

      lenses.push(new vscode.CodeLens(range, {
        title: '▶ play',
        command: 'vocab2code.play',
        arguments: [r.entry.word]
      }));
      lenses.push(new vscode.CodeLens(range, {
        title: '✓ known',
        command: 'vocab2code.markKnown',
        arguments: [r.entry.word]
      }));
      lenses.push(new vscode.CodeLens(range, {
        title: '✗ hard',
        command: 'vocab2code.markHard',
        arguments: [r.entry.word]
      }));
      lenses.push(new vscode.CodeLens(range, {
        title: '↺ reset',
        command: 'vocab2code.unmark',
        arguments: [r.entry.word]
      }));

      for (const ex of r.examples) {
        if (ex.line >= document.lineCount) continue;
        const exRange = new vscode.Range(ex.line, 0, ex.line, 0);
        lenses.push(new vscode.CodeLens(exRange, {
          title: '▶ play',
          command: 'vocab2code.play',
          arguments: [ex.text]
        }));
      }
    }
    return lenses;
  }
}
