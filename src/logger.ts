import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function initLogger(): vscode.OutputChannel {
  if (!channel) channel = vscode.window.createOutputChannel('vocab2code');
  return channel;
}

function ts(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function log(...parts: unknown[]): void {
  const line = `[${ts()}] ` + parts.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(' ');
  if (channel) channel.appendLine(line);
}

export function showLog(): void {
  if (channel) channel.show(true);
}

export function clearLog(): void {
  channel?.clear();
}
