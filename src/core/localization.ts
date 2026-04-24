import * as vscode from "vscode";

const fallbackMessages: Record<string, string> = {
  "info.gitSyncCommitted": "Git sync committed and pushed: {0}",
  "info.gitSyncPulled": "Git sync pulled: {0}",
  "statusBar.gitSync.label": "OolongNoteDock: Auto Sync",
  "statusBar.gitSync.tooltipEnabled":
    "OolongNoteDock Git auto-sync is ON. Click to sync now.",
  "statusBar.gitSync.tooltipBusy":
    "OolongNoteDock Git auto-sync is running…"
};

const formatFallback = (
  template: string,
  args: Array<string | number>
): string => {
  return template.replace(/\{(\d+)\}/g, (_, index) => {
    const value = args[Number(index)];
    return value === undefined ? "" : String(value);
  });
};

export const t = (key: string, ...args: Array<string | number>): string => {
  const translated = vscode.l10n.t(key, ...args);
  if (translated !== key) {
    return translated;
  }
  const fallback = fallbackMessages[key];
  if (!fallback) {
    return translated;
  }
  return formatFallback(fallback, args);
};
