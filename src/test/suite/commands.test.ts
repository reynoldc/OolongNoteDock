import * as assert from "assert";
import * as vscode from "vscode";
import { setup, suite, suiteSetup, teardown, test } from "mocha";
import { NoteTreeItem } from "../../notes/noteTreeProvider";
import { NoteNode } from "../../notes/noteTypes";

const extensionId = "oolong.oolong-note-dock";

const getNotesRoot = (): vscode.Uri => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "Workspace folder not found.");
  const config = vscode.workspace.getConfiguration("oolongNoteDock");
  const notesRootName = config.get<string>("notesRoot", ".");
  return vscode.Uri.joinPath(workspaceFolder.uri, notesRootName);
};

const deleteIfExists = async (uri: vscode.Uri): Promise<void> => {
  try {
    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
  } catch {
    return;
  }
};

const withPatchedInputBox = async (
  value: string,
  action: () => Promise<void>
): Promise<void> => {
  const windowRef = vscode.window as typeof vscode.window & {
    showInputBox: typeof vscode.window.showInputBox;
  };
  const original = windowRef.showInputBox;
  windowRef.showInputBox = async () => value;
  try {
    await action();
  } finally {
    windowRef.showInputBox = original;
  }
};

const withPatchedWarning = async (
  value: string | undefined,
  action: () => Promise<void>
): Promise<void> => {
  const windowRef = vscode.window as typeof vscode.window & {
    showWarningMessage: typeof vscode.window.showWarningMessage;
  };
  const original = windowRef.showWarningMessage;
  windowRef.showWarningMessage = ((
    _message: string,
    _options: vscode.MessageOptions,
    ..._items: string[]
  ) => Promise.resolve(value)) as typeof vscode.window.showWarningMessage;
  try {
    await action();
  } finally {
    windowRef.showWarningMessage = original;
  }
};

suite("OolongNoteDock Commands", () => {
  suiteSetup(async () => {
    await vscode.workspace
      .getConfiguration("oolongNoteDock")
      .update("notesRoot", "TestNotes", vscode.ConfigurationTarget.Workspace);
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, "Extension not found.");
    await extension.activate();
  });

  setup(async () => {
    await deleteIfExists(getNotesRoot());
  });

  teardown(async () => {
    await deleteIfExists(getNotesRoot());
  });

  test("createNote creates a markdown file", async () => {
    await withPatchedInputBox("NoteA", async () => {
      await vscode.commands.executeCommand("oolongNoteDock.createNote");
    });
    const noteUri = vscode.Uri.joinPath(getNotesRoot(), "NoteA.md");
    const stat = await vscode.workspace.fs.stat(noteUri);
    assert.strictEqual(stat.type, vscode.FileType.File);
  });

  test("renameNote renames a markdown file", async () => {
    const noteUri = vscode.Uri.joinPath(getNotesRoot(), "NoteB.md");
    await vscode.workspace.fs.createDirectory(getNotesRoot());
    await vscode.workspace.fs.writeFile(noteUri, new Uint8Array());
    const node: NoteNode = {
      uri: noteUri,
      name: "NoteB.md",
      type: "file",
      children: []
    };
    const item = new NoteTreeItem(node);
    await withPatchedInputBox("RenamedNote.md", async () => {
      await vscode.commands.executeCommand("oolongNoteDock.renameNote", item);
    });
    const renamedUri = vscode.Uri.joinPath(getNotesRoot(), "RenamedNote.md");
    const stat = await vscode.workspace.fs.stat(renamedUri);
    assert.strictEqual(stat.type, vscode.FileType.File);
  });

  test("renameNote appends md extension when missing", async () => {
    const noteUri = vscode.Uri.joinPath(getNotesRoot(), "NoteD.md");
    await vscode.workspace.fs.createDirectory(getNotesRoot());
    await vscode.workspace.fs.writeFile(noteUri, new Uint8Array());
    const node: NoteNode = {
      uri: noteUri,
      name: "NoteD.md",
      type: "file",
      children: []
    };
    const item = new NoteTreeItem(node);
    await withPatchedInputBox("RenamedNote", async () => {
      await vscode.commands.executeCommand("oolongNoteDock.renameNote", item);
    });
    const renamedUri = vscode.Uri.joinPath(getNotesRoot(), "RenamedNote.md");
    const stat = await vscode.workspace.fs.stat(renamedUri);
    assert.strictEqual(stat.type, vscode.FileType.File);
  });

  test("deleteNote deletes a markdown file", async () => {
    const noteUri = vscode.Uri.joinPath(getNotesRoot(), "NoteC.md");
    await vscode.workspace.fs.createDirectory(getNotesRoot());
    await vscode.workspace.fs.writeFile(noteUri, new Uint8Array());
    const node: NoteNode = {
      uri: noteUri,
      name: "NoteC.md",
      type: "file",
      children: []
    };
    const item = new NoteTreeItem(node);
    const confirmLabel = vscode.l10n.t("confirm.delete");
    await withPatchedWarning(confirmLabel, async () => {
      await vscode.commands.executeCommand("oolongNoteDock.deleteNote", item);
    });
    await assert.rejects(
      async () => {
        await vscode.workspace.fs.stat(noteUri);
      },
      (error: unknown) => error instanceof vscode.FileSystemError
    );
  });

  test("refreshNotes executes without error", async () => {
    await vscode.commands.executeCommand("oolongNoteDock.refreshNotes");
  });

  test("formatting commands execute without active editor", async () => {
    await vscode.commands.executeCommand("oolongNoteDock.bold");
    await vscode.commands.executeCommand("oolongNoteDock.italic");
    await vscode.commands.executeCommand("oolongNoteDock.heading");
    await vscode.commands.executeCommand("oolongNoteDock.list");
    await vscode.commands.executeCommand("oolongNoteDock.link");
    await vscode.commands.executeCommand("oolongNoteDock.codeBlock");
  });
});
