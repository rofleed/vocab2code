import * as vscode from 'vscode';
import { WordStore } from './wordStore';
import { DailyDocumentProvider, SCHEME, URI } from './viewProvider';
import { DailyCodeLensProvider } from './codeLensProvider';
import { AudioPlayer } from './audio';
import { pickDaily } from './dailyPicker';
import { importLibrary } from './importer';
import { initLogger, log, showLog, clearLog } from './logger';

export function activate(context: vscode.ExtensionContext) {
  initLogger();
  log('activate', `node=${process.version}`, `platform=${process.platform}`);
  const store = new WordStore(context);
  const docProvider = new DailyDocumentProvider(store);
  const lensProvider = new DailyCodeLensProvider(docProvider, store);
  const audio = new AudioPlayer(context);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, docProvider),
    vscode.languages.registerCodeLensProvider({ scheme: SCHEME }, lensProvider)
  );

  const refreshAll = () => {
    docProvider.refresh();
    lensProvider.refresh();
  };

  // Build today's prefetch list (words + every example sentence) without rendering.
  const buildPrefetchItems = (): { text: string }[] => {
    const cfg = vscode.workspace.getConfiguration('vocab2code');
    const library = cfg.get<string>('library', 'ielts');
    const count = cfg.get<number>('dailyCount', 20);
    const cooldown = cfg.get<number>('knownCooldownDays', 7);
    try {
      const entries = store.loadLibrary(library);
      const progress = store.getProgress();
      const picked = pickDaily(entries, progress, { library, count, knownCooldownDays: cooldown });
      const items: { text: string }[] = [];
      for (const w of picked) {
        items.push({ text: w.word });
        for (const s of w.senses) {
          for (const ex of s.examples) if (ex.en) items.push({ text: ex.en });
        }
      }
      return items;
    } catch {
      return [];
    }
  };

  const prefetchToday = () => {
    if (!vscode.workspace.getConfiguration('vocab2code').get<boolean>('audioPrefetch', false)) {
      audio.stopPrefetch();
      return;
    }
    const items = buildPrefetchItems();
    if (items.length) audio.prefetch(items);
  };

  // Network prefetch is explicitly opt-in.
  prefetchToday();

  context.subscriptions.push(
    vscode.commands.registerCommand('vocab2code.openDaily', async () => {
      const doc = await vscode.workspace.openTextDocument(URI);
      await vscode.languages.setTextDocumentLanguage(doc, 'typescript');
      await vscode.window.showTextDocument(doc, { preview: false });
      prefetchToday();
    }),

    vscode.commands.registerCommand('vocab2code.refresh', () => {
      refreshAll();
      prefetchToday();
    }),

    vscode.commands.registerCommand('vocab2code.switchLibrary', async () => {
      const current = vscode.workspace.getConfiguration('vocab2code').get<string>('library', 'ielts');
      const items: (vscode.QuickPickItem & { id: string })[] = store.listLibraries().map(lib => {
        const id = lib.meta.id;
        const s = store.getStats(id);
        const pct = s.total === 0 ? 0 : Math.round((s.known / s.total) * 100);
        const name = lib.meta.name !== id ? `${lib.meta.name} (${id})` : id;
        return {
          id,
          label: id === current ? `$(check) ${name}` : `   ${name}`,
          description: [id === current ? 'current' : '', lib.origin].filter(Boolean).join(' • '),
          detail: `${s.known}/${s.total} done (${pct}%)  •  ${s.hard} hard  •  ${s.remaining} remaining`
        };
      });
      if (!items.length) {
        vscode.window.showWarningMessage('vocab2code: no libraries found.');
        return;
      }
      const pick = await vscode.window.showQuickPick(items, { placeHolder: 'select library' });
      if (!pick) return;
      await vscode.workspace.getConfiguration('vocab2code').update('library', pick.id, vscode.ConfigurationTarget.Global);
      refreshAll();
      prefetchToday();
    }),

    vscode.commands.registerCommand('vocab2code.importLibrary', async () => {
      const id = await importLibrary(store);
      if (id) {
        await vscode.workspace.getConfiguration('vocab2code').update('library', id, vscode.ConfigurationTarget.Global);
      }
      refreshAll();
      prefetchToday();
    }),

    vscode.commands.registerCommand('vocab2code.openLibraryFolder', async () => {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(store.userLibraryDir));
      await vscode.env.openExternal(vscode.Uri.file(store.userLibraryDir));
    }),

    vscode.commands.registerCommand('vocab2code.play', (word: string) => {
      if (!word) return;
      audio.play(word);
    }),

    vscode.commands.registerCommand('vocab2code.markKnown', async (word: string) => {
      await store.setMark(word, 'known');
      refreshAll();
    }),

    vscode.commands.registerCommand('vocab2code.markHard', async (word: string) => {
      await store.setMark(word, 'hard');
      refreshAll();
    }),

    vscode.commands.registerCommand('vocab2code.unmark', async (word: string) => {
      await store.unmark(word);
      refreshAll();
    }),

    vscode.commands.registerCommand('vocab2code.diagnose', () => {
      const s = audio.cacheStats();
      log('diagnose', JSON.stringify(s));
      showLog();
    }),

    vscode.commands.registerCommand('vocab2code.clearAudioCache', async () => {
      await audio.clearCache();
      vscode.window.showInformationMessage('vocab2code: audio cache cleared.');
    }),

    vscode.commands.registerCommand('vocab2code.clearLog', () => {
      clearLog();
    }),

    vscode.commands.registerCommand('vocab2code.resetProgress', async () => {
      const choice = await vscode.window.showWarningMessage(
        'Reset learning progress for all libraries? If progress sync is enabled, this reset will also sync.',
        { modal: true }, 'Reset progress'
      );
      if (choice !== 'Reset progress') return;
      await store.resetProgress();
      refreshAll();
    })
  );

  context.subscriptions.push({ dispose: () => audio.dispose() });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('vocab2code')) {
        if (e.affectsConfiguration('vocab2code.syncProgress')) store.configureSync();
        refreshAll();
        if (e.affectsConfiguration('vocab2code.audioPrefetch') ||
            e.affectsConfiguration('vocab2code.library') ||
            e.affectsConfiguration('vocab2code.libraryPaths') ||
            e.affectsConfiguration('vocab2code.voice') ||
            e.affectsConfiguration('vocab2code.audioAccent') ||
            e.affectsConfiguration('vocab2code.engine') ||
            e.affectsConfiguration('vocab2code.dailyCount')) {
          prefetchToday();
        }
      }
    })
  );
}

export function deactivate() {}
