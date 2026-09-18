import { strict as assert } from 'node:assert';
import * as vscode from 'vscode';
import { describe, it } from 'mocha';

describe('Docx extension', () => {
  it('activates and registers its public commands', async () => {
    const extension = vscode.extensions.getExtension('showdocx.docx');
    assert.ok(extension, 'Expected the Docx extension to be installed.');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      'docx.openWith',
      'docx.exportHtml',
      'docx.exportMarkdown',
      'docx.exportPdf',
      'docx.search',
      'docx.searchWorkspace',
      'docx.showProperties',
      'docx.extractImages',
      'docx.writeMarkdownMirror',
      'docx.searchFor',
      'docx.zoomIn',
      'docx.zoomOut',
      'docx.zoomReset',
      'docx.toggleMode',
      'docx.cyclePageTheme',
      'docx.copyAsMarkdown',
      'docx.copyAsText',
      'docx.fitToWidth',
      'docx.fitToPage',
      'docx.showLog',
    ]) {
      assert.ok(commands.includes(command), `Expected command ${command} to be registered.`);
    }
  });
});
