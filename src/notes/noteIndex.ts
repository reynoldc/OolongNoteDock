import * as vscode from "vscode";
import { NoteNode, isImageFile } from "./noteTypes";

export class NoteIndex {
  private rootUri: vscode.Uri;
  private rootNode: NoteNode | undefined;

  public constructor(rootUri: vscode.Uri) {
    this.rootUri = rootUri;
  }

  public setRoot(rootUri: vscode.Uri): void {
    this.rootUri = rootUri;
    this.rootNode = undefined;
  }

  public async refresh(): Promise<NoteNode> {
    await vscode.workspace.fs.createDirectory(this.rootUri);
    this.rootNode = await this.buildTree(this.rootUri);
    return this.rootNode;
  }

  public getRoot(): NoteNode | undefined {
    return this.rootNode;
  }

  public async createNote(name: string, parentUri?: vscode.Uri): Promise<vscode.Uri> {
    const sanitized = name.trim();
    if (!sanitized) {
      throw new Error("Note name is empty.");
    }
    const fileName = sanitized.endsWith(".md") ? sanitized : `${sanitized}.md`;
    const baseUri = parentUri ?? this.rootUri;
    const targetUri = vscode.Uri.joinPath(baseUri, fileName);
    await vscode.workspace.fs.writeFile(targetUri, new Uint8Array());
    return targetUri;
  }

  public async deleteNode(uri: vscode.Uri, recursive: boolean): Promise<void> {
    await vscode.workspace.fs.delete(uri, { recursive, useTrash: true });
  }

  public async renameNode(
    uri: vscode.Uri,
    newName: string
  ): Promise<vscode.Uri> {
    const sanitized = newName.trim();
    if (!sanitized) {
      throw new Error("New name is empty.");
    }
    const segments = uri.path
      .split("/")
      .filter((segment) => segment.length > 0);
    segments.pop();
    const parentPath = "/" + segments.join("/");
    const parentUri = uri.with({ path: parentPath });
    const targetUri = vscode.Uri.joinPath(parentUri, sanitized);
    await vscode.workspace.fs.rename(uri, targetUri, { overwrite: false });
    return targetUri;
  }

  private async buildTree(uri: vscode.Uri): Promise<NoteNode> {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    const children: NoteNode[] = [];
    for (const [name, fileType] of entries) {
      const childUri = vscode.Uri.joinPath(uri, name);
      if (fileType === vscode.FileType.Directory) {
        const childNode = await this.buildTree(childUri);
        // Skip directories that contain no markdown or image files anywhere
        // in their subtree — otherwise the notes panel fills with irrelevant
        // empty folders (build output, attachments scaffolding, etc.).
        if (this.hasNoteDescendant(childNode)) {
          children.push({ ...childNode, name });
        }
      } else if (fileType === vscode.FileType.File && name.endsWith(".md")) {
        children.push({
          uri: childUri,
          name,
          type: "file",
          children: []
        });
      } else if (fileType === vscode.FileType.File && isImageFile(name)) {
        children.push({
          uri: childUri,
          name,
          type: "image",
          children: []
        });
      }
    }
    children.sort((a, b) => a.name.localeCompare(b.name));
    return {
      uri,
      name: uri.path.split("/").pop() ?? uri.path,
      type: "folder",
      children
    };
  }

  /** Returns true if this node or any descendant is a note/image file. */
  private hasNoteDescendant(node: NoteNode): boolean {
    if (node.type === "file" || node.type === "image") {
      return true;
    }
    return node.children.some((child) => this.hasNoteDescendant(child));
  }
}
