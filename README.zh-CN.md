<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/oolong_note_icon.png" alt="OolongNoteDock" width="128" />
</p>

<h1 align="center">OolongNoteDock 🍵📝</h1>

<p align="center">
  <em>让 VS Code 成为你的轻量化笔记工作台。</em>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <img alt="VS Code" src="https://img.shields.io/badge/VS%20Code-%5E1.75.0-007ACC?logo=visualstudiocode&logoColor=white" />
  <img alt="Markdown" src="https://img.shields.io/badge/Markdown-WYSIWYG-000?logo=markdown&logoColor=white" />
  <img alt="Made with TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?logo=typescript&logoColor=white" />
  <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/README-English-blue" /></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>简体中文</b>
</p>

---

OolongNoteDock 是一款面向 VS Code 的 **轻量化笔记工作台扩展**。所见即所得地编辑 Markdown、用 Git 同步你的笔记库、即时切换内容主题、同时兼容 Obsidian 笔记格式 —— 全部不离开编辑器。

> 🎯 **设计目标**：用同一个编辑器承担代码和笔记，并为后续的多格式文档与 AI IDE 联动预留空间。

---

## ✨ 特色功能

### 📝 所见即所得 Markdown 编辑器

基于 **Vditor** 内核，开箱支持 Mermaid 图表、数学公式、代码高亮和多种内容主题。边写边看成品效果，告别预览切换。

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/editor.png" alt="所见即所得编辑器" />
</p>

---

### 🔄 Git 自动同步与状态栏指示

可选开启的自动提交与拉取，**按工作区独立配置**。开启后状态栏右下角会显示 `$(sync) OolongNoteDock: Auto Sync`，一眼即可确认是否启用；点击图标可立即同步，过程中图标会旋转。

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/git_auto_sync.png" alt="Git 自动同步状态栏" />
</p>

---

### 🛠️ 多功能侧边栏与 Typora 主题导入

支持导入任意 Typora `.css` 主题（自动转换为 Vditor 格式），可在侧边栏溢出菜单中删除已导入的主题；侧边栏集成新建 / 重命名 / 删除 / 定位 / 发送终端等丰富操作。

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/multi_feature.png" alt="多功能侧边栏菜单" />
</p>

---

### 🎨 多主题切换

内置 **7 款** 内容主题随时切换，主题变更会实时同步到所有已打开的编辑器标签页，视图始终一致。

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/multi_theme.png" alt="多主题选择" />
</p>

---

### 🔗 兼容 Obsidian 图片引用格式

开启 `oolongNoteDock.obsidianImageFormat` 后，粘贴图片自动写入 `![[文件名]]` 的 Obsidian 语法，路径相对 `notesRoot` 解析。同一份笔记在 Obsidian 与 OolongNoteDock 中皆可原生渲染。

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/obsidian_image.png" alt="Obsidian 图片格式" />
</p>

---

### 💻 快速将文件路径发送到终端

在侧边栏点击笔记或文件夹旁的终端图标，即可把其绝对路径发送到当前活动终端（若无则新建一个）。便于快速 `cd`、对单个笔记执行 git 操作，或把 md 文件作为输入喂给其他命令行工具。

<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/send_terminal.png" alt="发送路径到终端" />
</p>

---

## 🚀 快速开始

<table>
<tr>
<td>

**通过 VSIX 安装**（推荐终端用户）

```bash
code --install-extension oolong-note-dock-<version>.vsix
```

</td>
<td>

**从源码运行**（适合贡献者）

```bash
npm install
cd media-src && npm install && cd ..
npm run webview:build
npm run compile
# 然后在 VS Code 中按 F5
```

</td>
</tr>
</table>

---

## 📦 功能一览

| 分类 | 能力 |
|---|---|
| 📂 **笔记树** | 文件夹、`.md`、图片统一显示并预览；自动隐藏无笔记的空目录。 |
| ⌨️ **快捷键** | `Delete` 移入回收站、`F2` 重命名；"新建笔记"按上下文定位目录。 |
| 🔄 **自动监听** | 本地文件变更即时反映，无需手动刷新。 |
| 📝 **Vditor 编辑器** | WYSIWYG 与即时渲染（IR）双模式。 |
| ⚡ **打包运行时** | esbuild 打包的 Webview，内置 Mermaid `11.13.0`、KaTeX、Highlight.js。 |
| 🎨 **主题体系** | 7 款内置 + 无限 Typora 导入，逐标签实时同步。 |
| 🧠 **智能底色** | 仅 `dark` 主题继承 VS Code 编辑器背景，亮色主题保持本色。 |
| 🖼️ **图片粘贴** | 自动保存到可配置的附件目录。 |
| 🔗 **Obsidian 模式** | `![[文件名]]` 语法，相对 `notesRoot` 解析。 |
| 🛡️ **快捷键拦截** | 拦截与 VS Code 默认冲突的 Vditor 快捷键（仅编辑器激活时）。 |
| 🔄 **Git 同步** | 定时提交 + 拉取，按工作区独立开关，状态栏指示。 |
| 💻 **终端集成** | 把任意笔记或文件夹路径发送到活动终端。 |

---

## 📦 打包

在项目根目录下构建一个干净、可分发的 `.vsix` 安装包：

```bash
npm run compile
cd media-src && npx esbuild ./src/main.ts --bundle --minify --sourcemap --outfile=../media/dist/main.js && cd ..
npx @vscode/vsce package --allow-missing-repository --no-rewrite-relative-links --skip-license
```

`.vscodeignore` 已排除 `src/`、`media-src/`、开发配置和 sourcemap，生成的 `oolong-note-dock-<version>.vsix` 约 6~7 MB。

在 VS Code 中通过 `扩展: 从 VSIX 安装...` 进行安装，或使用命令行：

```bash
code --install-extension ./oolong-note-dock-<version>.vsix
```

---

## ⚙️ 配置项

| 配置 | 默认值 | 说明 |
|---|---|---|
| `oolongNoteDock.notesRoot` | `.` | 工作区下的笔记根目录名，改动后即时刷新。 |
| `oolongNoteDock.imageSaveFolder` | `Attachments` | 图片保存目录，支持 `${projectRoot}`、`${dir}` 等变量。 |
| `oolongNoteDock.useVscodeThemeColor` | `true` | 使用 VS Code 主题颜色作为编辑器外框。 |
| `oolongNoteDock.customCss` | `""` | 编辑器注入的自定义 CSS。 |
| `oolongNoteDock.obsidianImageFormat` | `false` | 粘贴图片使用 `![[image.png]]` Obsidian 格式。 |
| `oolongNoteDock.gitSync.enabled` | `false` | 是否开启 Git 自动提交/拉取。 |
| `oolongNoteDock.gitSync.autoCommitInterval` | `30` | 自动提交间隔（分钟）。 |
| `oolongNoteDock.gitSync.autoPullInterval` | `30` | 自动拉取间隔（分钟）。 |
| `oolongNoteDock.gitSync.commitMessageTemplate` | `Auto save: ${date}` | 提交信息模板。 |
| `oolongNoteDock.gitSync.timingMode` | `afterLastEdit` | `afterLastEdit` 或 `fixedInterval`。 |

---

## 🚧 已知问题

- Vditor 高级功能（自定义渲染器、部分快捷键）的深度适配仍在进行中。

## 📋 更新日志

### v0.0.5

- **修复**：编辑器中按 `Tab` 键不再失效。此前在正文、代码块或列表项里按 Tab 会导致焦点跳到工具栏、光标消失，原因是没有设置 `vditor.options.tab`。现在 Tab 可正常插入制表符，列表项缩进、表格单元格跳转行为保持不变。

### v0.0.4

- **修复**：当文件被外部（例如 AI 代理、其他编辑器）修改后，编辑器自动刷新。此前需要关闭并重新打开标签页。

## 🗺️ 路线图

- [ ] 双视图模式与更完整的 Markdown 覆盖
- [ ] 图片上传与附件管理体验优化
- [ ] 多格式文档（HTML、富文本等）支持
- [ ] AI IDE 联动接口

---

## 🙏 致谢

- [**vscode-markdown-editor**](https://github.com/zaaack/vscode-markdown-editor) by **zaaack**（MIT）— 本项目直接复用了其 Webview 编辑器代码。
- [**Vditor**](https://github.com/Vanessa219/vditor) by **Vanessa219**（MIT）— 底层所见即所得引擎。
- 内置 Typora 风格主题改编自 Typora 社区。

---

## 📄 许可证

本项目基于 [**MIT License**](./LICENSE) 开源。

<p align="center">
  用 🍵 和 ☕ 为每天敲 Markdown 的人打造。
</p>
