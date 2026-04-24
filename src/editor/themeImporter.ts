import * as vscode from "vscode";
import * as path from "path";
import { t } from "../core/localization";

/**
 * Convert a Typora theme CSS to Vditor content-theme format.
 *
 * Main transformations:
 * - `#write` selector → `.vditor-reset`
 * - `body` / `html` standalone rules are removed (controlled by VS Code webview)
 * - `:root` CSS variables are preserved
 */
export function convertTyporaCss(css: string): string {
  let result = css;

  // Replace #write with .vditor-reset
  result = result.replace(/#write\b/g, ".vditor-reset");

  // Replace body selectors that style content (body h1 etc.) but not standalone body {}
  // "body h1" → ".vditor-reset h1"
  result = result.replace(/\bbody\s+(?=[a-zA-Z.#\[])/g, ".vditor-reset ");

  // Remove standalone body { ... } and html { ... } blocks
  result = result.replace(
    /(?:^|\n)\s*(?:html|body)\s*\{[^}]*\}/g,
    ""
  );

  // Replace content selector used by some Typora themes
  result = result.replace(/\.typora-export\s+/g, "");
  result = result.replace(/\.typora-export/g, "");

  return result.trim() + "\n";
}

/**
 * Import a Typora theme file into the Vditor content-theme directory.
 */
export async function importTheme(
  extensionUri: vscode.Uri
): Promise<void> {
  const files = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { "CSS Files": ["css"] },
    title: t("theme.importTitle"),
  });

  if (!files || files.length === 0) {
    return;
  }

  const sourceUri = files[0];
  if (!sourceUri) {
    return;
  }
  const rawCss = Buffer.from(
    await vscode.workspace.fs.readFile(sourceUri)
  ).toString("utf-8");

  const converted = convertTyporaCss(rawCss);

  const themeName = path
    .basename(sourceUri.fsPath, ".css")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  const targetUri = vscode.Uri.joinPath(
    extensionUri,
    "media",
    "vditor",
    "dist",
    "css",
    "content-theme",
    `${themeName}.css`
  );

  // Check if theme already exists
  try {
    await vscode.workspace.fs.stat(targetUri);
    const overwriteLabel = t("theme.overwrite");
    const overwrite = await vscode.window.showWarningMessage(
      t("theme.overwriteConfirm", themeName),
      { modal: true },
      overwriteLabel
    );
    if (overwrite !== overwriteLabel) {
      return;
    }
  } catch {
    // File doesn't exist, proceed
  }

  await vscode.workspace.fs.writeFile(
    targetUri,
    Buffer.from(converted, "utf-8")
  );

  void vscode.window.showInformationMessage(
    t("theme.imported", themeName)
  );
}

const BUILT_IN_THEMES = new Set([
  "ant-design",
  "dark",
  "drake-ayu",
  "github",
  "light",
  "vue",
  "wechat",
]);

/**
 * Delete a user-imported content theme. Built-in themes are protected.
 */
export async function deleteImportedTheme(
  extensionUri: vscode.Uri
): Promise<void> {
  const themeDir = vscode.Uri.joinPath(
    extensionUri,
    "media",
    "vditor",
    "dist",
    "css",
    "content-theme"
  );

  let entries: [string, vscode.FileType][] = [];
  try {
    entries = await vscode.workspace.fs.readDirectory(themeDir);
  } catch {
    void vscode.window.showErrorMessage(t("theme.readDirFailed"));
    return;
  }

  const imported = entries
    .filter(
      ([name, type]) =>
        type === vscode.FileType.File &&
        name.endsWith(".css") &&
        !BUILT_IN_THEMES.has(name.replace(/\.css$/, ""))
    )
    .map(([name]) => name.replace(/\.css$/, ""));

  if (imported.length === 0) {
    void vscode.window.showInformationMessage(t("theme.noImported"));
    return;
  }

  const picked = await vscode.window.showQuickPick(imported, {
    title: t("theme.deletePickTitle"),
    placeHolder: t("theme.deletePickPlaceholder"),
  });
  if (!picked) {
    return;
  }

  const deleteLabel = t("theme.delete");
  const confirm = await vscode.window.showWarningMessage(
    t("theme.deleteConfirm", picked),
    { modal: true },
    deleteLabel
  );
  if (confirm !== deleteLabel) {
    return;
  }

  const target = vscode.Uri.joinPath(themeDir, `${picked}.css`);
  try {
    await vscode.workspace.fs.delete(target);
  } catch (error) {
    void vscode.window.showErrorMessage(
      t("theme.deleteFailed", picked, (error as Error).message)
    );
    return;
  }

  void vscode.window.showInformationMessage(t("theme.deleted", picked));
}
