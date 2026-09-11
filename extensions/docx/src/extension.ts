import * as vscode from 'vscode';
import { compareWithHead, isComparableDocx, readDocxAtRef } from './diff/compareWithHead';
import { DIFF_SCHEME, DocxDiffContentProvider } from './diff/diffProvider';
import { DocxEditorProvider } from './docxEditorProvider';
import { extractImages } from './extractImages';
import { writeWorkspaceMirrors } from './mirror/markdownMirror';
import { DocumentTextIndex, showWorkspaceSearch } from './search/workspaceSearch';
import { validateDocxBytes } from './docxLoader';
import { disposeLog, getLog } from './log';
import { registerChatParticipant } from './lm/chatParticipant';
import { registerReadDocxTool } from './lm/readDocxTool';
import { watchFile } from './watchFile';

export function activate(context: vscode.ExtensionContext): void {
  const log = getLog();
  log.info('Docx activated.');
  const provider = DocxEditorProvider.register(context);
  const documentText = new DocumentTextIndex();

  const diffProvider = new DocxDiffContentProvider({
    readWorkingTree: (uri) => provider.readDocument(uri),
    readAtRef: async (uri, ref) => validateDocxBytes(
      await readDocxAtRef(uri, ref),
      provider.maxFileSize,
    ),
    watch: watchFile,
  });

  /**
   * The explorer and SCM menus pass the file they were invoked on; the palette
   * and the editor title bar pass nothing, so the focused document stands in.
   */
  const resolveCompareTarget = (uri?: vscode.Uri): vscode.Uri | undefined => {
    if (isComparableDocx(uri)) {
      return uri;
    }
    const active = provider.getActiveDocumentUri();
    if (isComparableDocx(active)) {
      return active;
    }
    const editorUri = vscode.window.activeTextEditor?.document.uri;
    return isComparableDocx(editorUri) ? editorUri : undefined;
  };

  // Undefined on a VS Code without the language model tool API, which is the
  // supported case rather than a failure: engines stays at ^1.85.0.
  const readDocxTool = registerReadDocxTool({
    workspaceFolders: () => (vscode.workspace.workspaceFolders ?? [])
      .filter((folder) => folder.uri.scheme === 'file')
      .map((folder) => folder.uri.fsPath),
    read: (uri) => provider.readDocument(uri),
  });
  if (readDocxTool) {
    context.subscriptions.push(readDocxTool);
  }

  // Undefined on a VS Code without the chat API, which is supported rather than
  // a failure, for the same reason the tool above is feature-detected.
  const chatParticipant = registerChatParticipant(context, {
    activeDocument: () => provider.getActiveDocumentUri(),
    read: (uri) => provider.readDocument(uri),
  });
  if (chatParticipant) {
    context.subscriptions.push(chatParticipant);
  }

  context.subscriptions.push(
    log,
    diffProvider,
    vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, diffProvider),
    vscode.commands.registerCommand('docx.compareWithHead', async (uri?: vscode.Uri) => {
      await compareWithHead(resolveCompareTarget(uri), diffProvider);
    }),
    vscode.commands.registerCommand('docx.showLog', () => {
      log.show();
    }),
    vscode.commands.registerCommand('docx.openWith', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        void vscode.window.showWarningMessage('Select a DOCX file to open with Docx.');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', target, DocxEditorProvider.viewType);
    }),
    vscode.commands.registerCommand('docx.exportHtml', () => {
      provider.sendToActivePanel('requestExportHtml');
    }),
    vscode.commands.registerCommand('docx.exportMarkdown', () => {
      provider.sendToActivePanel('requestExportMarkdown');
    }),
    vscode.commands.registerCommand('docx.exportPdf', () => {
      provider.sendToActivePanel('requestExportPdf');
    }),
    vscode.commands.registerCommand('docx.copyAsMarkdown', () => {
      provider.sendToActivePanel('requestCopyMarkdown');
    }),
    vscode.commands.registerCommand('docx.copyAsText', () => {
      provider.sendToActivePanel('requestCopyText');
    }),
    vscode.commands.registerCommand('docx.search', () => {
      provider.sendToActivePanel('search');
    }),
    vscode.commands.registerCommand('docx.searchWorkspace', (query?: unknown) => {
      showWorkspaceSearch(documentText, typeof query === 'string' ? query : undefined);
    }),
    vscode.commands.registerCommand('docx.showProperties', () => {
      provider.sendToActivePanel('showProperties');
    }),
    vscode.commands.registerCommand('docx.writeMarkdownMirror', async () => {
      await writeWorkspaceMirrors({ read: (uri) => provider.readDocument(uri) });
    }),
    vscode.commands.registerCommand('docx.extractImages', async (uri?: vscode.Uri) => {
      await extractImages(resolveCompareTarget(uri), {
        read: (target) => provider.readDocument(target),
      });
    }),
    // Opens the in-document search already carrying a query. Not in the command
    // palette: it takes an argument, and the workspace search is what sends it.
    vscode.commands.registerCommand('docx.searchFor', (query?: unknown) => {
      provider.sendToActivePanel('search', {
        query: typeof query === 'string' ? query : undefined,
      });
    }),
    vscode.commands.registerCommand('docx.zoomIn', () => {
      provider.sendToActivePanel('zoomIn');
    }),
    vscode.commands.registerCommand('docx.zoomOut', () => {
      provider.sendToActivePanel('zoomOut');
    }),
    vscode.commands.registerCommand('docx.zoomReset', () => {
      provider.sendToActivePanel('zoomReset');
    }),
    vscode.commands.registerCommand('docx.toggleMode', () => {
      provider.sendToActivePanel('toggleMode');
    }),
    vscode.commands.registerCommand('docx.cyclePageTheme', () => {
      provider.sendToActivePanel('cyclePageTheme');
    }),
    vscode.commands.registerCommand('docx.fitToWidth', () => {
      provider.sendToActivePanel('fitWidth');
    }),
    vscode.commands.registerCommand('docx.fitToPage', () => {
      provider.sendToActivePanel('fitPage');
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('docx')) {
        provider.broadcastSettings();
      }
    }),
  );
}

export function deactivate(): void {
  // Disposables registered in the extension context handle cleanup.
  disposeLog();
}
