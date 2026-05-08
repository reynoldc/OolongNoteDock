<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/oolong_note_icon.png" alt="OolongNoteDock" width="128" />
</p>

<h1 align="center">OolongNoteDock 🍵📝</h1>

<p align="center">
  <em>A lightweight note-taking workbench inside VS Code.</em>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <img alt="VS Code" src="https://img.shields.io/badge/VS%20Code-%5E1.75.0-007ACC?logo=visualstudiocode&logoColor=white" />
  <img alt="Markdown" src="https://img.shields.io/badge/Markdown-WYSIWYG-000?logo=markdown&logoColor=white" />
  <img alt="Made with TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?logo=typescript&logoColor=white" />
  <a href="./README.zh-CN.md"><img alt="中文" src="https://img.shields.io/badge/README-%E4%B8%AD%E6%96%87-red" /></a>
</p>

<p align="center">
  <b>English</b> · <a href="./README.zh-CN.md">简体中文</a>
</p>

---

OolongNoteDock turns VS Code into a **lightweight note-taking workbench**. Edit Markdown the way you read it, sync your vault with Git, switch content themes on the fly, and stay friendly to Obsidian-style notes — all without leaving your editor.

> 🎯 **Design goal**: a single editor for code and notes, with room to grow into multi-format documents and AI-IDE integration.

---

## ✨ Highlights

### 📝 WYSIWYG Markdown Editor

Powered by **Vditor** — Mermaid diagrams, math formulas, syntax highlighting, and multiple content themes ship out of the box. Edit Markdown the way you read it, no constant preview-switching.

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/editor.png" alt="WYSIWYG editor" />
</p>

---

### 🔄 Git Auto-Sync with Status Bar Indicator

Opt-in automatic commit & pull, configured **per workspace**. Once enabled, the status bar shows `$(sync) OolongNoteDock: Auto Sync` so you always know at a glance whether it's on. Click the item to sync immediately — the icon spins while syncing.

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/git_auto_sync.png" alt="Git auto-sync status bar" />
</p>

---

### 🛠️ Feature-Rich Sidebar & Typora Theme Import

Import any Typora `.css` theme — automatically converted to Vditor format. Delete imported ones from the sidebar overflow menu, and manage notes with rich sidebar actions (create / rename / delete / reveal / send-to-terminal).

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/multi_feature.png" alt="Feature-rich sidebar menu" />
</p>

---

### 🎨 Multiple Built-in Themes

Switch among **seven** built-in content themes. Theme changes broadcast live to all open editor tabs, so every view stays in sync.

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/multi_theme.png" alt="Theme picker" />
</p>

---

### 🔗 Obsidian-Compatible Image Format

Turn on `oolongNoteDock.obsidianImageFormat` and pasted images are saved as `![[filename]]` — Obsidian vaults and OolongNoteDock stay source-compatible. Paths resolve relative to `notesRoot`, so the same note renders correctly in either tool.

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/obsidian_image.png" alt="Obsidian image format" />
</p>

---

### 💻 Send File / Folder Path to Terminal

One click on the terminal icon next to any note or folder sends its absolute path into the active terminal (or spawns a new one). Perfect for `cd` jumps, running git on a single note, or piping a markdown file into other CLI tools.

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/send_terminal.png" alt="Send path to terminal" />
</p>

---

## 🚀 Quick Start

<table>
<tr>
<td>

**Install from VSIX** (recommended for end users)

```bash
code --install-extension oolong-note-dock-<version>.vsix
```

</td>
<td>

**Run from source** (for contributors)

```bash
npm install
cd media-src && npm install && cd ..
npm run webview:build
npm run compile
# then press F5 in VS Code
```

</td>
</tr>
</table>

---

## 📦 Features at a Glance

| Area | What you get |
|---|---|
| 📂 **Notes Tree** | Folders, `.md`, and images — all with preview. Empty folders hidden automatically. |
| ⌨️ **Shortcuts** | `Delete` to trash, `F2` to rename. Context-aware "New Note". |
| 🔄 **Auto Watcher** | Local changes reflected without manual refresh. |
| 📝 **Vditor Editor** | WYSIWYG + Instant-Rendering (IR) modes. |
| ⚡ **Bundled Runtime** | esbuild-bundled webview. Mermaid `11.13.0`, KaTeX, Highlight.js ready. |
| 🎨 **Themes** | 7 built-ins + unlimited Typora imports. Per-tab live sync. |
| 🧠 **Smart BG Color** | Only the `dark` theme inherits VS Code's editor background — light themes stay light. |
| 🖼️ **Image Paste** | Auto-save to configurable attachment folder. |
| 🔗 **Obsidian Mode** | `![[filename]]` syntax, resolved against `notesRoot`. |
| 🛡️ **Shortcut Guard** | Intercepts Vditor shortcuts that clash with VS Code defaults (only while editor focused). |
| 🔄 **Git Sync** | Scheduled commits + pulls, per-workspace, with status bar indicator. |
| 💻 **Terminal** | Send any note or folder path to the active terminal. |

---

## 📦 Packaging

Build a clean, installable `.vsix` (run from the project root):

```bash
npm run compile
cd media-src && npx esbuild ./src/main.ts --bundle --minify --sourcemap --outfile=../media/dist/main.js && cd ..
npx @vscode/vsce package --allow-missing-repository --no-rewrite-relative-links --skip-license
```

`.vscodeignore` already excludes `src/`, `media-src/`, dev configs, and source maps, so the resulting `oolong-note-dock-<version>.vsix` is ~6–7 MB.

Install it in VS Code via `Extensions: Install from VSIX...`, or from the command line:

```bash
code --install-extension ./oolong-note-dock-<version>.vsix
```

---

## ⚙️ Settings

| Setting | Default | Description |
|---|---|---|
| `oolongNoteDock.notesRoot` | `.` | Folder name for notes under the workspace root. Live-reloads on change. |
| `oolongNoteDock.imageSaveFolder` | `Attachments` | Folder for uploaded images. Supports `${projectRoot}`, `${dir}`, etc. |
| `oolongNoteDock.useVscodeThemeColor` | `true` | Use VS Code theme colors in the editor chrome. |
| `oolongNoteDock.customCss` | `""` | Inject custom CSS into the editor. |
| `oolongNoteDock.obsidianImageFormat` | `false` | Use Obsidian `![[image.png]]` format for pasted images. |
| `oolongNoteDock.gitSync.enabled` | `false` | Enable automatic Git commit / pull. |
| `oolongNoteDock.gitSync.autoCommitInterval` | `30` | Minutes between auto-commits. |
| `oolongNoteDock.gitSync.autoPullInterval` | `30` | Minutes between auto-pulls. |
| `oolongNoteDock.gitSync.commitMessageTemplate` | `Auto save: ${date}` | Commit message template. |
| `oolongNoteDock.gitSync.timingMode` | `afterLastEdit` | `afterLastEdit` or `fixedInterval`. |

---

## 🚧 Known Issues

- Deep integration of advanced Vditor features (custom renderers, a few shortcuts) is still in progress.

## 📋 Changelog

### v0.0.5

- **Fix**: The `Tab` key no longer breaks the editor. Previously pressing Tab in normal text, code blocks, or list items moved focus to the toolbar and hid the caret, because `vditor.options.tab` was never set. Tab now inserts a real tab character, and list-item indent / table cell navigation keep working as before.

### v0.0.4

- **Fix**: Editor now auto-refreshes when the file is modified externally (e.g. AI agent, other editors). Previously required closing and reopening the tab.

### v0.0.3

- **Feat**: Theme importer dark-mode support & layout fix.

## 🗺️ Roadmap

- [ ] Dual-pane view and more complete Markdown coverage
- [ ] Improved image upload & attachment management
- [ ] Multi-format document support (HTML, rich text, etc.)
- [ ] AI-IDE integration hooks

---

## 🙏 Acknowledgements

- [**vscode-markdown-editor**](https://github.com/zaaack/vscode-markdown-editor) by **zaaack** (MIT) — the webview editor code is directly reused from this project.
- [**Vditor**](https://github.com/Vanessa219/vditor) by **Vanessa219** (MIT) — the underlying WYSIWYG engine.
- Built-in Typora-style themes adapted from the Typora community.

---

## 📄 License

Released under the [**MIT License**](./LICENSE).

<p align="center">
  Made with 🍵 and ☕ for people who write Markdown every day.
</p>
