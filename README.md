<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/oolong_note_icon.png" alt="OolongNoteDock" width="128" />
</p>

# OolongNoteDock

English | [简体中文](./README.zh-CN.md)

OolongNoteDock is a VS Code extension that turns VS Code into a lightweight note-taking workbench. It lays the groundwork for future support of additional document formats and AI IDE integrations.

## Highlights

### WYSIWYG Markdown Editor

Powered by Vditor, with Mermaid, math, code highlighting, and multiple content themes — edit Markdown the way you read it.

![WYSIWYG editor](https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/editor.png)

### Git Auto-Sync with Status Bar Indicator

Opt-in automatic commit and pull (configured per workspace). Once enabled, the status bar shows `$(sync) OolongNoteDock: Auto Sync` so you always know at a glance whether it's on. Click the item to sync immediately; the icon spins while syncing.

![Git auto-sync status bar](https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/git_auto_sync.png)

### Feature-Rich: Typora Theme Import & More

Import any Typora `.css` theme (automatically converted to Vditor format), delete imported ones from the sidebar overflow menu, and manage notes with rich sidebar actions.

![Feature-rich sidebar menu](https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/multi_feature.png)

### Multiple Built-in Themes

Switch among seven built-in content themes; theme changes broadcast live to all open editor tabs.

![Theme picker](https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/multi_theme.png)

## Features

- Notes tree in the sidebar (folders, `.md` files, and image files with preview)
- Create, delete, and rename notes (with `Delete` / `F2` shortcuts)
- "Create Note" is context-aware — it targets the selected folder or the directory of the selected file
- "Reveal Active Note in Tree" button — locate the currently active editor tab inside the notes tree with one click
- Send a file or directory path to the terminal
- Automatic watching of local notes and images (no manual refresh needed)
- Custom Markdown editor
- Integrated **Vditor** editor (based on [vscode-markdown-editor](https://github.com/zaaack/vscode-markdown-editor)) with WYSIWYG and Instant-Rendering (IR) modes
- Webview bundled with esbuild; Mermaid 11.13.0, code highlighting, and math formulas work out of the box
- Multiple built-in content themes: Light, Dark, Ant Design, WeChat, GitHub, Vue, Drake Ayu
- Import Typora CSS themes (automatically converted to Vditor format)
- Delete imported themes (built-ins are protected); the theme list refreshes instantly after import / delete
- Content theme synchronizes live across all open editor tabs
- Vditor background color follows the content theme — only the Dark theme inherits VS Code's editor background, so light themes stay light even under a dark VS Code theme
- Code-block syntax highlighting with automatic Light/Dark switching
- Full Markdown support (tables, math, Mermaid, etc.)
- Save/undo are delegated to the VS Code document model
- Configurable attachment folder and automatic paste-to-save for images
- Obsidian-style image references (`![[image.png]]`)
- Intercepts Vditor shortcuts that would conflict with VS Code defaults (only while the editor is focused)
- Automatic Git sync (scheduled commits and pulls)

## Installation (from source)

1. Install dependencies: `npm install`
2. Install webview dependencies: `cd media-src && npm install`
3. Build the webview: `npm run webview:build`
4. Compile the extension: `npm run compile`
5. Press `F5` in VS Code to launch a debug instance

## Packaging

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

## Known Issues

- Deep integration of advanced Vditor features (custom renderers, a few shortcuts) is still in progress

## Settings

- `oolongNoteDock.notesRoot` — folder name for notes under the workspace root (default `OolongNotes`); live-reload on change
- `oolongNoteDock.imageSaveFolder` — folder for uploaded images (default `Attachments`); supports `${projectRoot}`, `${dir}`, etc.
- `oolongNoteDock.useVscodeThemeColor` — use VS Code theme colors in the editor (default `true`)
- `oolongNoteDock.customCss` — custom CSS for the editor
- `oolongNoteDock.obsidianImageFormat` — use Obsidian image reference format `![[image.png]]` (default `false`). When enabled, pasted images use this format and paths are resolved relative to `notesRoot`

## Acknowledgements

- [vscode-markdown-editor](https://github.com/zaaack/vscode-markdown-editor) by zaaack (MIT License) — this project directly reuses its webview editor code

## Roadmap

- Dual-pane view and more complete Markdown coverage
- Improved image upload and attachment management

## License

[MIT](./LICENSE)
