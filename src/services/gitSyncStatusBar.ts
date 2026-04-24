import * as vscode from "vscode";
import { t } from "../core/localization";

/**
 * Shows the Git auto-sync state in the VS Code status bar.
 *
 * - Hidden when auto-sync is disabled.
 * - Shows "$(sync) Notes" (stable) when enabled and idle.
 * - Shows "$(sync~spin) Notes" while a sync is in progress.
 * - Click → oolongNoteDock.syncNow.
 * - Tooltip explains the current state.
 */
export class GitSyncStatusBar {
  private readonly item: vscode.StatusBarItem;
  private enabled = false;
  private busy = false;

  public constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = "oolongNoteDock.syncNow";
    this.refresh();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.refresh();
  }

  public setBusy(busy: boolean): void {
    this.busy = busy;
    this.refresh();
  }

  private refresh(): void {
    if (!this.enabled) {
      this.item.hide();
      return;
    }
    const icon = this.busy ? "$(sync~spin)" : "$(sync)";
    this.item.text = `${icon} ${t("statusBar.gitSync.label")}`;
    this.item.tooltip = this.busy
      ? t("statusBar.gitSync.tooltipBusy")
      : t("statusBar.gitSync.tooltipEnabled");
    this.item.show();
  }

  public dispose(): void {
    this.item.dispose();
  }
}
