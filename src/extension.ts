import * as vscode from "vscode";
import { withErrorHandling } from "./core/errors";
import { disposeOutputChannel, getOutputChannel, log } from "./core/output";
import { t } from "./core/localization";
import { MarkdownCustomEditor } from "./editor/markdownCustomEditor";
import { importTheme, deleteImportedTheme } from "./editor/themeImporter";
import { NoteCommands } from "./notes/noteCommands";
import { NoteIndex } from "./notes/noteIndex";
import { NoteTreeItem, NoteTreeProvider } from "./notes/noteTreeProvider";
import { NoteWatcher } from "./notes/noteWatcher";
import { GitService } from "./services/gitService";
import { GitSyncStatusBar } from "./services/gitSyncStatusBar";
import { SyncScheduler, editGitignore } from "./services/syncScheduler";

let disposables: vscode.Disposable[] = [];
let noteWatcher: NoteWatcher | undefined;
let noteTreeProvider: NoteTreeProvider | undefined;
let noteIndex: NoteIndex | undefined;
let markdownEditor: MarkdownCustomEditor | undefined;
let gitService: GitService | undefined;
let syncScheduler: SyncScheduler | undefined;
let gitSyncStatusBar: GitSyncStatusBar | undefined;

export const activate = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  disposables = [];
  getOutputChannel();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    void vscode.window.showInformationMessage(t("info.noWorkspace"));
    return;
  }
  const config = vscode.workspace.getConfiguration("oolongNoteDock");
  const notesRootName = config.get<string>("notesRoot", ".");
  const notesRootUri = vscode.Uri.joinPath(workspaceFolder.uri, notesRootName);
  
  // Git Services
  gitService = new GitService();
  syncScheduler = new SyncScheduler(gitService, notesRootUri);
  gitSyncStatusBar = new GitSyncStatusBar();
  syncScheduler.onStateChange((state) => {
    gitSyncStatusBar?.setEnabled(state.enabled);
    gitSyncStatusBar?.setBusy(state.busy);
  });

  noteIndex = new NoteIndex(notesRootUri);
  noteTreeProvider = new NoteTreeProvider(noteIndex);
  const treeView = vscode.window.createTreeView("oolongNoteDock.notes", {
    treeDataProvider: noteTreeProvider,
    showCollapseAll: true
  });
  noteWatcher = new NoteWatcher(notesRootUri, noteTreeProvider);
  noteWatcher.start();
  markdownEditor = new MarkdownCustomEditor(context);

  /**
   * Reveal the file currently shown in the active editor tab inside the notes
   * tree. Reads from tabGroups.activeTab instead of activeTextEditor, because
   * custom text editors (our Vditor tabs) do not register as TextEditors.
   */
  const revealActiveTab = async (): Promise<void> => {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    let uri: vscode.Uri | undefined;
    const input = activeTab?.input as unknown;
    if (
      input &&
      typeof input === "object" &&
      "uri" in input &&
      (input as { uri: unknown }).uri instanceof vscode.Uri
    ) {
      uri = (input as { uri: vscode.Uri }).uri;
    }
    if (!uri) {
      log("[tree-reveal] no active tab with a file uri");
      return;
    }
    if (uri.scheme !== "file") {
      log(`[tree-reveal] skip — scheme=${uri.scheme}`);
      return;
    }
    const item = await noteTreeProvider?.findTreeItem(uri);
    if (!item) {
      log(`[tree-reveal] no tree node for ${uri.fsPath}`);
      void vscode.window.showInformationMessage(t("info.revealNotFound"));
      return;
    }
    try {
      await treeView.reveal(item, {
        select: true,
        focus: true,
        expand: true,
      });
      log(`[tree-reveal] revealed ${uri.fsPath}`);
    } catch (err) {
      log(`[tree-reveal] reveal threw: ${(err as Error).message}`);
    }
  };

  const noteCommands = new NoteCommands(noteIndex, noteTreeProvider);
  const register = <TArgs extends unknown[]>(
    command: string,
    handler: (...args: TArgs) => Promise<void>
  ): void => {
    const disposable = vscode.commands.registerCommand(
      command,
      withErrorHandling(command, handler)
    );
    disposables.push(disposable);
  };

  register("oolongNoteDock.createNote", (item?: NoteTreeItem) =>
    noteCommands.createNote(item)
  );
  register("oolongNoteDock.deleteNote", (item?: NoteTreeItem) =>
    noteCommands.deleteNote(item)
  );
  register("oolongNoteDock.renameNote", (item?: NoteTreeItem) =>
    noteCommands.renameNote(item)
  );
  register("oolongNoteDock.refreshNotes", () => noteCommands.refreshNotes());
  register("oolongNoteDock.revealActiveNote", () => revealActiveTab());
  register("oolongNoteDock.editGitignore", () => editGitignore(workspaceFolder.uri));
  register("oolongNoteDock.sendToTerminal", async (item?: NoteTreeItem) => {
    if (!item) {
      return;
    }
    const terminal =
      vscode.window.activeTerminal ??
      vscode.window.createTerminal();
    terminal.show(true);
    terminal.sendText(item.uri.fsPath, false);
  });
  register("oolongNoteDock.syncNow", async () => {
    const repo = gitService?.getRepository(notesRootUri);
    if (!repo || !gitService) {
      return;
    }
    await gitService.commitAndSync(repo);
  });
  register("oolongNoteDock.syncingIndicator", async () => Promise.resolve());
  // No-op command: absorbs VS Code shortcuts so they pass through to webview editor
  register("oolongNoteDock.noop", async () => Promise.resolve());

  register("oolongNoteDock.openSettings", async () => {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:oolong.oolong-note-dock"
    );
  });
  register("oolongNoteDock.importTheme", async () => {
    await importTheme(context.extensionUri);
    await MarkdownCustomEditor.broadcastThemeList(context.extensionUri);
  });
  register("oolongNoteDock.deleteImportedTheme", async () => {
    await deleteImportedTheme(context.extensionUri);
    await MarkdownCustomEditor.broadcastThemeList(context.extensionUri);
  });

  const providerDisposable = vscode.window.registerCustomEditorProvider(
    "oolongNoteDock.markdown",
    markdownEditor,
    {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  );

  disposables.push(
    providerDisposable,
    treeView,
    vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
      if (event.affectsConfiguration("oolongNoteDock.notesRoot")) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const config = vscode.workspace.getConfiguration("oolongNoteDock");
          const notesRootName = config.get<string>("notesRoot", ".");
          const notesRootUri = vscode.Uri.joinPath(
            workspaceFolder.uri,
            notesRootName
          );

          noteIndex?.setRoot(notesRootUri);
          noteWatcher?.updateRoot(notesRootUri);

          syncScheduler?.dispose();
          if (gitService) {
            syncScheduler = new SyncScheduler(gitService, notesRootUri);
          }

          void noteTreeProvider?.refresh();
        }
      } else if (event.affectsConfiguration("oolongNoteDock")) {
        void noteTreeProvider?.refresh();
      }
    })
  );

  context.subscriptions.push(...disposables);
  await noteTreeProvider.refresh();
};

export const deactivate = (): void => {
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables = [];
  noteWatcher?.dispose();
  noteWatcher = undefined;
  noteTreeProvider = undefined;
  noteIndex = undefined;
  markdownEditor?.dispose();
  markdownEditor = undefined;
  syncScheduler?.dispose();
  syncScheduler = undefined;
  gitSyncStatusBar?.dispose();
  gitSyncStatusBar = undefined;
  gitService = undefined;
  disposeOutputChannel();
};
