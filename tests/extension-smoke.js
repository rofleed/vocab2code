// Run by the VS Code extension test host, against the unpacked VSIX.
const assert = require('node:assert/strict');
const vscode = require('vscode');

exports.run = async function () {
  const manifest = require('../package.json');
  const extension = vscode.extensions.getExtension(`${manifest.publisher}.${manifest.name}`);
  assert(extension, 'Installed test extension not found');
  await extension.activate();
  const cfg = vscode.workspace.getConfiguration('vocab2code');
  assert.equal(cfg.get('audioPrefetch'), false);
  assert.equal(cfg.get('syncProgress'), false);
  await vscode.commands.executeCommand('vocab2code.openDaily');
  const editor = vscode.window.activeTextEditor;
  assert(editor, 'Daily module did not open');
  assert.equal(editor.document.languageId, 'typescript');
  const text = editor.document.getText();
  assert(text.includes('phonetic('), 'Daily module lacks vocabulary');
  assert(text.includes('sense('), 'Bundled examples were not rendered');
  await vscode.commands.executeCommand('vocab2code.refresh');
  await vscode.commands.executeCommand('vocab2code.clearAudioCache');
  await vscode.commands.executeCommand('vocab2code.clearLog');
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  console.log('PASS: VSIX activation, offline defaults, daily rendering with examples, refresh and cleanup commands.');
};
