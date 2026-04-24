import * as assert from "assert";
import * as vscode from "vscode";
import { setup, suite, suiteSetup, teardown, test } from "mocha";
import { NoteNode } from "../../notes/noteTypes";
import { NoteTreeItem } from "../../notes/noteTreeProvider";

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
  values: string[],
  action: () => Promise<void>
): Promise<void> => {
  const windowRef = vscode.window as typeof vscode.window & {
    showInputBox: typeof vscode.window.showInputBox;
  };
  const original = windowRef.showInputBox;
  let index = 0;
  windowRef.showInputBox = async () => values[index++];
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

const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    const currentValue = result[index];
    const nextValue = result[next];
    if (currentValue === undefined || nextValue === undefined) {
      continue;
    }
    result[index] = nextValue;
    result[next] = currentValue;
  }
  return result;
};

suite("OolongNoteDock Smoke", () => {
  suiteSetup(async () => {
    await vscode.workspace
      .getConfiguration("oolongNoteDock")
      .update("notesRoot", "SmokeNotes", vscode.ConfigurationTarget.Workspace);
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

  test("create and delete 100 notes", async () => {
    const noteNames = Array.from({ length: 100 }, (_value, index) => {
      return `SmokeNote-${index + 1}`;
    });
    await withPatchedInputBox(noteNames, async () => {
      for (let index = 0; index < noteNames.length; index += 1) {
        await vscode.commands.executeCommand("oolongNoteDock.createNote");
      }
    });

    const noteUris = noteNames.map((name) =>
      vscode.Uri.joinPath(getNotesRoot(), `${name}.md`)
    );
    const items = shuffle(noteUris).map((uri) => {
      const node: NoteNode = {
        uri,
        name: uri.path.split("/").pop() ?? uri.path,
        type: "file",
        children: []
      };
      return new NoteTreeItem(node);
    });

    const confirmLabel = vscode.l10n.t("confirm.delete");
    await withPatchedWarning(confirmLabel, async () => {
      for (const item of items) {
        await vscode.commands.executeCommand("oolongNoteDock.deleteNote", item);
      }
    });

    for (const uri of noteUris) {
      await assert.rejects(
        async () => {
          await vscode.workspace.fs.stat(uri);
        },
        (error: unknown) => error instanceof vscode.FileSystemError
      );
    }
  });
});
