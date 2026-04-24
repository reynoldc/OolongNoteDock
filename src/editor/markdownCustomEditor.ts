import * as vscode from "vscode";
import * as path from "path";
import { t } from "../core/localization";

const KeyVditorOptions = "vditor.options";

function debug(...args: unknown[]): void {
  console.log(...args);
}

function showError(msg: string): void {
  void vscode.window.showErrorMessage(`[OolongNoteDock] ${msg}`);
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|bmp)$/i;

/**
 * Convert Obsidian `![[name]]` to standard markdown `![name](folder/name)`.
 * Used when sending document content to the webview for Vditor to render.
 */
function obsidianToMarkdown(text: string, assetsRelPath: string): string {
  return text.replace(/!\[\[([^\]\r\n]+?)\]\]/g, (_match, filename: string) => {
    const name = filename.trim();
    if (!name) return _match;
    if (!IMAGE_EXTENSIONS.test(name)) return _match;
    const encoded = encodeURIComponent(name);
    return `![${name}](${assetsRelPath}/${encoded})`;
  });
}

/**
 * Convert standard markdown image `![name](folder/name)` back to Obsidian `![[name]]`.
 * Only converts images whose path starts with the assets folder.
 * Used when saving webview content back to the document.
 */
function markdownToObsidian(text: string, assetsRelPath: string): string {
  const escapedFolder = assetsRelPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `!\\[([^\\]]*)\\]\\(${escapedFolder}/([^)\\s]+)\\)`,
    "g"
  );
  return text.replace(pattern, (_match, _alt: string, encodedName: string) => {
    const filename = decodeURIComponent(encodedName);
    if (!IMAGE_EXTENSIONS.test(filename)) return _match;
    return `![[${filename}]]`;
  });
}

export class MarkdownCustomEditor implements vscode.CustomTextEditorProvider {
  private readonly context: vscode.ExtensionContext;
  private static activePanels = new Set<vscode.WebviewPanel>();

  public constructor(context: vscode.ExtensionContext) {
    this.context = context;
    context.globalState.setKeysForSync([KeyVditorOptions]);
  }

  /** Scan content-theme directory, returning user-imported themes (non built-in). */
  public static async scanExtraThemes(
    extensionUri: vscode.Uri
  ): Promise<Record<string, string>> {
    const builtIn = new Set([
      "ant-design", "dark", "drake-ayu", "github", "light", "vue", "wechat",
    ]);
    const extras: Record<string, string> = {};
    try {
      const themeDir = vscode.Uri.joinPath(
        extensionUri, "media", "vditor", "dist", "css", "content-theme"
      );
      const entries = await vscode.workspace.fs.readDirectory(themeDir);
      for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.endsWith(".css")) continue;
        const key = name.replace(/\.css$/, "");
        if (!builtIn.has(key)) {
          const label = key.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          extras[key] = label;
        }
      }
    } catch {
      // ignore
    }
    return extras;
  }

  /** Broadcast an updated theme list to all open markdown editor panels. */
  public static async broadcastThemeList(
    extensionUri: vscode.Uri
  ): Promise<void> {
    const extras = await MarkdownCustomEditor.scanExtraThemes(extensionUri);
    for (const panel of MarkdownCustomEditor.activePanels) {
      panel.webview.postMessage({
        command: "update-theme-list",
        extraThemes: extras,
      });
    }
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    const uri = document.uri;
    const disposables: vscode.Disposable[] = [];
    let isEditing = false;

    MarkdownCustomEditor.activePanels.add(webviewPanel);

    // Set webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file("/"),
        ...this.getDriveRoots(),
      ],
    };

    // Init webview content
    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      uri
    );
    webviewPanel.title = path.basename(uri.fsPath);

    // Update title to show edit status
    const updateEditTitle = (): void => {
      const isDirty = document.isDirty;
      if (isDirty !== isEditing) {
        isEditing = isDirty;
        webviewPanel.title = `${isDirty ? "[edit]" : ""}${path.basename(
          uri.fsPath
        )}`;
      }
    };

    // Vditor CDN path (local resources for mermaid, katex, etc.)
    const vditorCdn = webviewPanel.webview
      .asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, "media", "vditor")
      )
      .toString();

    // Scan content-theme directory for user-imported themes
    const getExtraThemes = (): Promise<Record<string, string>> =>
      MarkdownCustomEditor.scanExtraThemes(this.context.extensionUri);

    // Obsidian image format helpers
    const useObsidian = (): boolean =>
      this.config.get<boolean>("obsidianImageFormat") === true;
    const assetsRelPath = (): string => {
      const folder = this.getAssetsFolder(uri);
      return path
        .relative(path.dirname(uri.fsPath), folder)
        .replace(/\\/g, "/");
    };

    // Send update to webview
    const updateWebview = (
      props: {
        type?: "init" | "update";
        options?: unknown;
        theme?: "dark" | "light";
        extraThemes?: Record<string, string>;
      } = {}
    ): void => {
      let content = document.getText();
      if (useObsidian()) {
        content = obsidianToMarkdown(content, assetsRelPath());
      }
      webviewPanel.webview.postMessage({
        command: "update",
        content,
        cdn: vditorCdn,
        ...props,
      });
    };

    // Listen for document close
    disposables.push(
      vscode.workspace.onDidCloseTextDocument((e) => {
        if (e.fileName === uri.fsPath) {
          webviewPanel.dispose();
        }
      })
    );

    // Listen for theme changes
    disposables.push(
      vscode.window.onDidChangeActiveColorTheme(async (theme) => {
        const extras = await getExtraThemes();
        updateWebview({
          type: "init",
          options: {
            useVscodeThemeColor: this.config.get<boolean>(
              "useVscodeThemeColor"
            ),
            ...(this.context.globalState.get(KeyVditorOptions) as Record<string, unknown> ?? {}),
          },
          theme:
            theme.kind === vscode.ColorThemeKind.Dark ? "dark" : "light",
          extraThemes: extras,
        });
      })
    );

    // Listen for document changes (sync from external editor to webview)
    disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.fileName !== document.fileName) {
          return;
        }
        // Do not sync when webview panel is active (avoid circular updates)
        if (webviewPanel.active) {
          return;
        }
        updateWebview();
        updateEditTitle();
      })
    );

    // Handle messages from webview
    disposables.push(
      webviewPanel.webview.onDidReceiveMessage(async (message) => {
        debug("msg from webview", message, webviewPanel.active);

        const syncToEditor = async (): Promise<void> => {
          let content: string = message.content;
          if (useObsidian()) {
            content = markdownToObsidian(content, assetsRelPath());
          }
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
          );
          await vscode.workspace.applyEdit(edit);
        };

        switch (message.command) {
          case "ready": {
            const stored = this.context.globalState.get(KeyVditorOptions) as Record<string, unknown> ?? {};
            const extras = await getExtraThemes();
            updateWebview({
              type: "init",
              options: {
                useVscodeThemeColor: this.config.get<boolean>(
                  "useVscodeThemeColor"
                ),
                ...stored,
              },
              theme:
                vscode.window.activeColorTheme.kind ===
                vscode.ColorThemeKind.Dark
                  ? "dark"
                  : "light",
              extraThemes: extras,
            });
            break;
          }
          case "save-options":
            await this.context.globalState.update(
              KeyVditorOptions,
              message.options
            );
            // Broadcast theme change to other open panels so they update live
            {
              let broadcast = 0;
              for (const panel of MarkdownCustomEditor.activePanels) {
                if (panel !== webviewPanel) {
                  panel.webview.postMessage({
                    command: "sync-theme",
                    options: message.options,
                  });
                  broadcast++;
                }
              }
              debug(
                "[OND] save-options received, broadcast to",
                broadcast,
                "other panels (total",
                MarkdownCustomEditor.activePanels.size,
                ")"
              );
            }
            break;
          case "info":
            void vscode.window.showInformationMessage(message.content);
            break;
          case "error":
            showError(message.content);
            break;
          case "edit":
            if (webviewPanel.active) {
              await syncToEditor();
              updateEditTitle();
            }
            break;
          case "reset-config":
            await this.context.globalState.update(KeyVditorOptions, {});
            break;
          case "save":
            await syncToEditor();
            await document.save();
            updateEditTitle();
            break;
          case "upload": {
            const assetsFolder = this.getAssetsFolder(uri);
            try {
              await vscode.workspace.fs.createDirectory(
                vscode.Uri.file(assetsFolder)
              );
            } catch (error) {
              console.error(error);
              showError(t("error.invalidImageFolder", assetsFolder));
            }
            await Promise.all(
              (message.files as { base64: string; name: string }[]).map(
                async (f) => {
                  const content = Buffer.from(f.base64, "base64");
                  return vscode.workspace.fs.writeFile(
                    vscode.Uri.file(path.join(assetsFolder, f.name)),
                    content
                  );
                }
              )
            );
            const files = (
              message.files as { base64: string; name: string }[]
            ).map((f) =>
              path
                .relative(
                  path.dirname(uri.fsPath),
                  path.join(assetsFolder, f.name)
                )
                .replace(/\\/g, "/")
            );
            webviewPanel.webview.postMessage({
              command: "uploaded",
              files,
              obsidianFormat: useObsidian(),
            });
            break;
          }
          case "open-link": {
            let url: string = message.href;
            if (!/^http/.test(url)) {
              url = path.resolve(uri.fsPath, "..", url);
            }
            void vscode.commands.executeCommand(
              "vscode.open",
              vscode.Uri.parse(url)
            );
            break;
          }
        }
      })
    );

    // Clean up resources
    webviewPanel.onDidDispose(() => {
      MarkdownCustomEditor.activePanels.delete(webviewPanel);
      for (const d of disposables) {
        d.dispose();
      }
    });
  }

  public dispose(): void {
    // nothing to clean up
  }

  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("oolongNoteDock");
  }

  private getDriveRoots(): vscode.Uri[] {
    const data: vscode.Uri[] = [];
    for (let i = 65; i <= 90; i++) {
      data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`));
    }
    return data;
  }

  private getAssetsFolder(uri: vscode.Uri): string {
    const imageSaveFolder = (
      this.config.get<string>("imageSaveFolder") || "Attachments"
    )
      .replace(
        "${projectRoot}",
        vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath || ""
      )
      .replace("${file}", uri.fsPath)
      .replace(
        "${fileBasenameNoExtension}",
        path.basename(uri.fsPath, path.extname(uri.fsPath))
      )
      .replace("${dir}", path.dirname(uri.fsPath));
    // Obsidian mode: resolve relative to notesRoot (vault root)
    // Standard mode: resolve relative to the document's directory
    if (this.config.get<boolean>("obsidianImageFormat") === true) {
      const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
      const notesRootName = this.config.get<string>("notesRoot") || ".";
      const vaultRoot = wsFolder
        ? path.join(wsFolder.uri.fsPath, notesRootName)
        : path.dirname(uri.fsPath);
      return path.resolve(vaultRoot, imageSaveFolder);
    }
    return path.resolve(path.dirname(uri.fsPath), imageSaveFolder);
  }

  private getHtmlForWebview(
    webview: vscode.Webview,
    uri: vscode.Uri
  ): string {
    const toUri = (f: string): vscode.Uri =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, f)
      );
    const baseHref =
      path.dirname(
        webview.asWebviewUri(vscode.Uri.file(uri.fsPath)).toString()
      ) + "/";
    const toMediaPath = (f: string): string => `media/dist/${f}`;
    const JsFiles = ["main.js"].map(toMediaPath).map(toUri);
    const CssFiles = ["main.css"].map(toMediaPath).map(toUri);
    const iconJs = toUri("media/vditor/dist/js/icons/ant.js");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="${baseHref}" />
  ${CssFiles.map((f) => `<link href="${f}" rel="stylesheet">`).join("\n")}
  <title>markdown editor</title>
  <style>${this.config.get<string>("customCss") || ""}</style>
</head>
<body>
  <div id="app"></div>
  <script src="${iconJs}"></script>
  ${JsFiles.map((f) => `<script src="${f}"></script>`).join("\n")}
</body>
</html>`;
  }
}
