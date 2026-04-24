import * as vscode from "vscode";
import * as path from "path";
import { NoteIndex } from "./noteIndex";
import { NoteTreeItem, NoteTreeProvider } from "./noteTreeProvider";
import { t } from "../core/localization";
import { log } from "../core/output";

export class NoteCommands {
  private readonly noteIndex: NoteIndex;
  private readonly treeProvider: NoteTreeProvider;

  public constructor(noteIndex: NoteIndex, treeProvider: NoteTreeProvider) {
    this.noteIndex = noteIndex;
    this.treeProvider = treeProvider;
  }

  public async createNote(item?: NoteTreeItem): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: t("prompt.noteName")
    });
    if (!name) {
      return;
    }
    let parentUri: vscode.Uri | undefined;
    if (item) {
      parentUri =
        item.type === "folder"
          ? item.uri
          : vscode.Uri.file(path.dirname(item.uri.fsPath));
    }
    const uri = await this.noteIndex.createNote(name, parentUri);
    await this.treeProvider.refresh();
    await vscode.window.showTextDocument(uri, { preview: false });
  }

  public async deleteNote(item?: NoteTreeItem): Promise<void> {
    const targetUri = item?.uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      return;
    }
    const confirm = await vscode.window.showWarningMessage(
      t("confirm.deleteNote"),
      { modal: true },
      t("confirm.delete")
    );
    if (confirm !== t("confirm.delete")) {
      return;
    }
    const isFolder = item?.type === "folder";
    await this.noteIndex.deleteNode(targetUri, Boolean(isFolder));
    await this.treeProvider.refresh();
  }

  public async renameNote(item?: NoteTreeItem): Promise<void> {
    const targetUri = item?.uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      return;
    }
    const newName = await vscode.window.showInputBox({
      prompt: t("prompt.renameNote")
    });
    if (!newName) {
      return;
    }
    const trimmedName = newName.trim();
    const isMarkdownFile =
      item?.type === "file" ||
      targetUri.path.toLowerCase().endsWith(".md") ||
      vscode.window.activeTextEditor?.document.uri.toString() === targetUri.toString();
    let normalizedName = trimmedName;
    if (isMarkdownFile && !trimmedName.toLowerCase().endsWith(".md")) {
      const baseName = path.basename(trimmedName, path.extname(trimmedName));
      normalizedName = `${baseName}.md`;
    }
    await this.noteIndex.renameNode(targetUri, normalizedName);
    await this.treeProvider.refresh();
  }

  public async refreshNotes(): Promise<void> {
    await this.treeProvider.refresh();
  }
}
