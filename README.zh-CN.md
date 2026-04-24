<p align="center">
  <img src="https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/oolong_note_icon.png" alt="OolongNoteDock" width="128" />
</p>

# OolongNoteDock

[English](./README.md) | 简体中文

OolongNoteDock 是一个面向 VS Code 的笔记插件，目标是将 VS Code 作为轻量化笔记工作台使用，并为后续的多格式文档与 AI IDE 联动打下基础。

## 特色功能

### 所见即所得 Markdown 编辑器

基于 Vditor 的 WYSIWYG 编辑体验，开箱支持 Mermaid、数学公式、代码高亮和多种内容主题，边写边看成品效果。

![所见即所得编辑器](https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/editor.png)

### Git 自动同步与状态栏指示

按工作区配置自动提交与拉取（默认关闭，需手动开启）。开启后状态栏右下角会显示 `$(sync) OolongNoteDock: Auto Sync`，一眼即可确认当前是否启用；点击图标可立即同步，同步过程中图标会旋转。

![Git 自动同步状态栏](https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/git_auto_sync.png)

### 多功能侧边栏与 Typora 主题导入

支持导入任意 Typora `.css` 主题（自动转换为 Vditor 格式），可在侧边栏溢出菜单中管理已导入的主题，还提供多种便捷操作。

![多功能侧边栏菜单](https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/multi_feature.png)

### 多主题切换

内置 7 款内容主题可随时切换，主题变更会实时同步到所有已打开的编辑器标签页。

![多主题选择](https://raw.githubusercontent.com/reynoldc/OolongNoteDock/main/resources/multi_theme.png)

## 功能清单

- 侧边栏笔记树（支持文件夹、.md 文件、图片文件显示与预览）
- 笔记新建、删除、重命名（支持 Delete / F2 快捷键）
- 新建笔记智能定位到选中目录或文档所在目录
- 侧边栏提供"在笔记树中定位当前文件"按钮，一键定位当前编辑标签页在笔记树中的位置
- 发送文件/目录路径到终端
- 本地笔记文件和图片自动监听（无需手动刷新）
- Markdown 自定义编辑器
- 集成 **Vditor** 编辑器（基于 [vscode-markdown-editor](https://github.com/zaaack/vscode-markdown-editor)），支持所见即所得 (WYSIWYG) 与即时渲染 (IR) 模式
- Webview 编辑器通过 esbuild 打包，Mermaid 11.13.0 图表渲染、代码高亮、数学公式等开箱即用
- 内置多种内容主题：Light、Dark、Ant Design、WeChat、GitHub、Vue、Drake Ayu
- 支持导入 Typora 主题 CSS 文件，自动转换并生效
- 支持删除已导入的主题（内置主题受保护），导入/删除后编辑器主题列表即时刷新
- 内容主题在多个已打开的编辑器标签间实时同步切换
- 内容主题决定 Vditor 底色：仅 Dark 主题继承 VS Code 编辑器背景，避免亮色主题被强制刷黑
- 支持代码语法高亮与主题自动切换 (Light/Dark)
- 完整的 Markdown 语法支持（表格、数学公式、Mermaid 图表等）
- 保存与撤销交由 VS Code 文档模型管理
- 支持附件文件夹配置与图片粘贴自动保存
- 支持 Obsidian 图片引用格式 `![[image.png]]`
- 拦截 Vditor 快捷键避免与 VS Code 默认快捷键冲突（仅在编辑器激活时生效）
- Git 自动同步（定时提交与拉取）

## 安装方式

1. 安装依赖：`npm install`
2. 安装 Webview 依赖：`cd media-src && npm install`
3. 构建 Webview：`npm run webview:build`
4. 编译扩展：`npm run compile`
5. 在 VS Code 中按 `F5` 启动调试实例

## 打包

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

## 已知问题

- Vditor 高级功能（如自定义渲染器、部分快捷键）的深度适配仍在进行中

## 设置

- `oolongNoteDock.notesRoot`：笔记根文件夹名称（默认 OolongNotes），支持动态修改并即时刷新
- `oolongNoteDock.imageSaveFolder`：图片保存文件夹（默认 Attachments），支持 `${projectRoot}`、`${dir}` 等变量
- `oolongNoteDock.useVscodeThemeColor`：使用 VS Code 主题颜色（默认 true）
- `oolongNoteDock.customCss`：编辑器自定义 CSS
- `oolongNoteDock.obsidianImageFormat`：使用 Obsidian 图片引用格式 `![[image.png]]`（默认关闭）。开启后粘贴图片自动使用此格式，图片路径相对于 notesRoot 解析

## 致谢

- [vscode-markdown-editor](https://github.com/zaaack/vscode-markdown-editor) by zaaack (MIT License) — 本项目直接复用了该项目的 Webview 编辑器代码

## 下一步计划

- 双视图模式与更完整 Markdown 覆盖
- 图片上传与附件管理体验优化

## 许可证

[MIT](./LICENSE)
