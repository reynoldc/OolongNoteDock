import * as assert from "assert";
import * as vscode from "vscode";
import { setup, suite, suiteSetup, teardown, test } from "mocha";

const extensionId = "oolong.oolong-note-dock";

const getWorkspaceRoot = (): vscode.Uri => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "Workspace folder not found.");
  return workspaceFolder.uri;
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

suite("OolongNoteDock Configuration", () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, "Extension not found.");
    await extension.activate();
  });

  setup(async () => {
     // Clean up potential directories
     await deleteIfExists(vscode.Uri.joinPath(getWorkspaceRoot(), "ConfigNoteA"));
     await deleteIfExists(vscode.Uri.joinPath(getWorkspaceRoot(), "ConfigNoteB"));
  });

  teardown(async () => {
     await deleteIfExists(vscode.Uri.joinPath(getWorkspaceRoot(), "ConfigNoteA"));
     await deleteIfExists(vscode.Uri.joinPath(getWorkspaceRoot(), "ConfigNoteB"));
  });

  test("Changing notesRoot updates the target directory for new notes", async () => {
    // 1. Set root to ConfigNoteA
    await vscode.workspace
      .getConfiguration("oolongNoteDock")
      .update("notesRoot", "ConfigNoteA", vscode.ConfigurationTarget.Workspace);
      
    // Wait a bit for configuration to propagate
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Create Note
    await withPatchedInputBox("Note1", async () => {
      await vscode.commands.executeCommand("oolongNoteDock.createNote");
    });

    // 3. Verify file exists in ConfigNoteA
    const note1Uri = vscode.Uri.joinPath(getWorkspaceRoot(), "ConfigNoteA", "Note1.md");
    const stat1 = await vscode.workspace.fs.stat(note1Uri);
    assert.strictEqual(stat1.type, vscode.FileType.File);

    // 4. Change root to ConfigNoteB
    await vscode.workspace
      .getConfiguration("oolongNoteDock")
      .update("notesRoot", "ConfigNoteB", vscode.ConfigurationTarget.Workspace);
      
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    // 5. Create Note
    await withPatchedInputBox("Note2", async () => {
      await vscode.commands.executeCommand("oolongNoteDock.createNote");
    });

    // 6. Verify file exists in ConfigNoteB
    const note2Uri = vscode.Uri.joinPath(getWorkspaceRoot(), "ConfigNoteB", "Note2.md");
    const stat2 = await vscode.workspace.fs.stat(note2Uri);
    assert.strictEqual(stat2.type, vscode.FileType.File);
    
    // 7. Verify Note2 is NOT in ConfigNoteA
    const note2InA = vscode.Uri.joinPath(getWorkspaceRoot(), "ConfigNoteA", "Note2.md");
    await assert.rejects(async () => {
        await vscode.workspace.fs.stat(note2InA);
    });
  });
});
