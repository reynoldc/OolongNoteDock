import * as vscode from "vscode";
import { NoteTreeProvider } from "./noteTreeProvider";

export class NoteWatcher {
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly treeProvider: NoteTreeProvider;
  private readonly subscriptions: vscode.Disposable[] = [];
  private rootUri: vscode.Uri;

  public constructor(rootUri: vscode.Uri, treeProvider: NoteTreeProvider) {
    this.rootUri = rootUri;
    this.treeProvider = treeProvider;
  }

  public updateRoot(rootUri: vscode.Uri): void {
    this.rootUri = rootUri;
    this.start();
  }

  public start(): void {
    this.disposeWatcher();

    const pattern = new vscode.RelativePattern(this.rootUri, "**/*.{md,png,jpg,jpeg,gif,svg,webp,bmp,ico}");
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.subscriptions.push(
      this.watcher.onDidCreate(() => void this.treeProvider.refresh()),
      this.watcher.onDidDelete(() => void this.treeProvider.refresh()),
      this.watcher.onDidChange(() => void this.treeProvider.refresh())
    );
  }

  private disposeWatcher(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
    this.subscriptions.length = 0;
    this.watcher?.dispose();
    this.watcher = undefined;
  }

  public dispose(): void {
    this.disposeWatcher();
  }
}
