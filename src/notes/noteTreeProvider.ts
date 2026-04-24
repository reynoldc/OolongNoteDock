import * as vscode from "vscode";
import { NoteIndex } from "./noteIndex";
import { NoteNode } from "./noteTypes";

export class NoteTreeItem extends vscode.TreeItem {
  public readonly uri: vscode.Uri;
  public readonly type: "folder" | "file" | "image";

  public constructor(node: NoteNode) {
    const collapsibleState =
      node.type === "folder"
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
    super(node.name, collapsibleState);
    this.uri = node.uri;
    this.type = node.type;
    this.resourceUri = node.uri;
    this.contextValue = node.type;
    if (node.type === "file" || node.type === "image") {
      this.command = {
        command: "vscode.open",
        title: "Open Note",
        arguments: [node.uri]
      };
    }
    if (node.type === "image") {
      this.iconPath = new vscode.ThemeIcon("file-media");
    }
  }
}

export class NoteTreeProvider implements vscode.TreeDataProvider<NoteTreeItem> {
  private readonly noteIndex: NoteIndex;
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    NoteTreeItem | undefined
  >();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  /**
   * Cache of uri.toString() → TreeItem so that getChildren / getParent /
   * findTreeItem all return the SAME instance for a given uri. TreeView.reveal
   * compares by identity, so returning fresh objects causes it to silently
   * fail.
   */
  private readonly itemCache = new Map<string, NoteTreeItem>();

  public constructor(noteIndex: NoteIndex) {
    this.noteIndex = noteIndex;
  }

  public async refresh(): Promise<void> {
    this.itemCache.clear();
    await this.noteIndex.refresh();
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  public getTreeItem(element: NoteTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: NoteTreeItem): Promise<NoteTreeItem[]> {
    const root = this.noteIndex.getRoot() ?? (await this.noteIndex.refresh());
    const node = element ? this.findNode(root, element.uri) : root;
    if (!node) {
      return [];
    }
    return node.children.map((child) => this.getOrCreateItem(child));
  }

  /**
   * Required by TreeView.reveal(): walks from the given node back up to the
   * notes root, returning the parent node as a TreeItem (or undefined for root).
   */
  public async getParent(
    element: NoteTreeItem
  ): Promise<NoteTreeItem | undefined> {
    const root = this.noteIndex.getRoot() ?? (await this.noteIndex.refresh());
    const parent = this.findParent(root, element.uri);
    if (!parent || parent.uri.toString() === root.uri.toString()) {
      return undefined;
    }
    return this.getOrCreateItem(parent);
  }

  /**
   * Find the tree item corresponding to a file uri, so callers can pass it
   * to TreeView.reveal(). Ensures the ancestor chain's TreeItems are also in
   * the cache (so reveal can walk up via getParent → cached items).
   */
  public async findTreeItem(
    uri: vscode.Uri
  ): Promise<NoteTreeItem | undefined> {
    const root = this.noteIndex.getRoot() ?? (await this.noteIndex.refresh());
    const node = this.findNode(root, uri);
    if (!node || node.uri.toString() === root.uri.toString()) {
      return undefined;
    }
    // Pre-populate cache for the whole ancestor chain so reveal's getParent
    // walk returns stable items.
    const ancestors: NoteNode[] = [];
    let cursor: NoteNode | undefined = this.findParent(root, uri);
    while (cursor && cursor.uri.toString() !== root.uri.toString()) {
      ancestors.push(cursor);
      cursor = this.findParent(root, cursor.uri);
    }
    for (const n of ancestors) {
      this.getOrCreateItem(n);
    }
    return this.getOrCreateItem(node);
  }

  private getOrCreateItem(node: NoteNode): NoteTreeItem {
    const key = node.uri.toString();
    const cached = this.itemCache.get(key);
    if (cached) {
      return cached;
    }
    const created = new NoteTreeItem(node);
    this.itemCache.set(key, created);
    return created;
  }

  private findNode(root: NoteNode, uri: vscode.Uri): NoteNode | undefined {
    if (root.uri.toString() === uri.toString()) {
      return root;
    }
    for (const child of root.children) {
      if (child.uri.toString() === uri.toString()) {
        return child;
      }
      if (child.type === "folder") {
        const match = this.findNode(child, uri);
        if (match) {
          return match;
        }
      }
    }
    return undefined;
  }

  private findParent(
    root: NoteNode,
    targetUri: vscode.Uri
  ): NoteNode | undefined {
    for (const child of root.children) {
      if (child.uri.toString() === targetUri.toString()) {
        return root;
      }
      if (child.type === "folder") {
        const match = this.findParent(child, targetUri);
        if (match) {
          return match;
        }
      }
    }
    return undefined;
  }
}
