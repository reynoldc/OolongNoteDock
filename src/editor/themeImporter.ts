import * as vscode from "vscode";
import * as path from "path";
import { t } from "../core/localization";

/**
 * Convert a Typora theme CSS to Vditor content-theme format.
 *
 * Main transformations:
 * - `#write` selector → `.vditor-reset`
 * - `body` / `html` standalone rules are removed (their layout concerns are
 *   owned by the VS Code webview), BUT their `background` and `color` are
 *   re-emitted onto `.vditor` so the imported theme keeps its page tint.
 * - `:root` CSS variables are preserved
 */
export function convertTyporaCss(css: string, themeKey?: string): string {
  let result = css;

  // 1. Extract background / color from standalone `body { ... }` BEFORE we
  //    strip those blocks, so the imported theme's page tint (e.g. a dark
  //    background on a "dark" Typora theme) survives.
  const bodyExtract = extractBodyColors(result);

  // 2. Replace #write with .vditor-reset
  result = result.replace(/#write\b/g, ".vditor-reset");

  // 3. Replace body selectors that style content (body h1 etc.) — but not
  //    standalone body {} — so "body h1" becomes ".vditor-reset h1".
  result = result.replace(/\bbody\s+(?=[a-zA-Z.#\[])/g, ".vditor-reset ");

  // 4. Remove standalone body { ... }, html { ... }, and combined
  //    `html, body { ... }` blocks (any comma-separated list of html/body).
  result = result.replace(
    /(?:^|\n)\s*(?:(?:html|body)\s*,\s*)*(?:html|body)\s*\{[^}]*\}/g,
    ""
  );

  // 5. Replace content selector used by some Typora themes
  result = result.replace(/\.typora-export\s+/g, "");
  result = result.replace(/\.typora-export/g, "");

  // 5b. Remove Typora-specific layout rules that conflict with Vditor:
  //     - padding-left/right on .vditor-reset (Vditor has its own padding)
  //     - negative margin-left on headings (Typora's "outdent heading" style)
  //     - @media blocks that only adjust these paddings/margins
  result = result.replace(/\bpadding-left\s*:\s*\d+ch\s*;/g, "");
  result = result.replace(/\bpadding-right\s*:\s*\d+ch\s*;/g, "");
  result = result.replace(/\bmargin-left\s*:\s*-\d+ch\s*;/g, "");

  // 6. Scope bare HTML-element selectors (e.g. `pre {}`, `code {}`,
  //    `h1::before {}`, `table th {}`) to `.vditor-reset`, otherwise Vditor's
  //    own `.vditor-ir pre.vditor-reset` etc. (higher specificity) overrides
  //    them and the imported theme's code-block / table colors never apply.
  //    Strip comments first so block boundaries (` } */comment/* a {`) don't
  //    confuse the scoping regex.
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  result = scopeBareElementSelectors(result);

  // 7. Re-emit body background / color as Vditor overrides. We scope them by
  //    `[data-content-theme="<key>"]` so other themes aren't affected.
  const scopedOverrides = buildScopedOverrides(themeKey, bodyExtract);

  // 8. Prepend a chrome-hint marker so the frontend can pick the correct
  //    Vditor chrome theme (dark/classic) based on the actual background
  //    luminance — not just the theme name.
  const chromeHint = detectChromeHint(bodyExtract.background);

  return (chromeHint + result.trim() + "\n" + scopedOverrides).trim() + "\n";
}

interface BodyColors {
  background?: string;
  color?: string;
}

/** Pull `background[-color]` and `color` out of any body { ... } block,
 *  including combined selectors like `html, body { ... }`. */
function extractBodyColors(css: string): BodyColors {
  const out: BodyColors = {};
  // Build a lookup table of :root CSS variables so we can resolve var()
  // references to concrete values (e.g. var(--bg) → #282828).
  const rootVars = extractRootVars(css);

  // Match standalone `body { ... }` as well as combined selectors that include
  // `body` (e.g. `html, body { ... }`, `html,body{ ... }`).
  const regex = /(?:^|\n)\s*(?:[\w]+\s*,\s*)*body(?:\s*,\s*[\w]+)*\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    const block = match[1];
    if (!block) continue;
    // background-color has higher precedence than background shorthand
    const bgColor = /background-color\s*:\s*([^;]+?)\s*;/i.exec(block);
    // Use greedy last-match for `background:` since CSS cascading means the
    // last declaration wins (gruvbox has two `background:` lines).
    const bgShortAll = [...block.matchAll(/background\s*:\s*([^;]+?)\s*;/gi)];
    const bgShort = bgShortAll.length > 0 ? bgShortAll[bgShortAll.length - 1] : null;
    const color = /(?:^|;|\{)\s*color\s*:\s*([^;]+?)\s*;/i.exec(block);
    if (bgColor && bgColor[1]) out.background = resolveVar(bgColor[1], rootVars);
    else if (bgShort && bgShort[1]) {
      // Take only the color token; strip image/gradient/url if any.
      const candidate = bgShort[1].trim();
      // Accept common color literals: #hex, rgb/rgba, var(), named colors
      const colorMatch =
        /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|var\([^)]+\)|[a-zA-Z]+)/.exec(candidate);
      if (colorMatch && colorMatch[1]) out.background = resolveVar(colorMatch[1], rootVars);
    }
    if (color && color[1]) out.color = resolveVar(color[1], rootVars);
  }
  return out;
}

/** Extract all CSS custom properties from :root { ... } blocks. */
function extractRootVars(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  const rootRegex = /:root\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rootRegex.exec(css)) !== null) {
    const block = m[1];
    if (!block) continue;
    const propRegex = /(--[\w-]+)\s*:\s*([^;]+?)\s*;/g;
    let p: RegExpExecArray | null;
    while ((p = propRegex.exec(block)) !== null) {
      if (p[1] && p[2]) vars.set(p[1], p[2]);
    }
  }
  return vars;
}

/** Resolve a CSS value that may be `var(--name)` to its concrete value.
 *  Follows up to 5 levels of indirection (var → var → literal). */
function resolveVar(value: string, rootVars: Map<string, string>): string {
  let current = value.trim();
  for (let i = 0; i < 5; i++) {
    const varMatch = /^var\(\s*(--[\w-]+)\s*\)$/.exec(current);
    if (!varMatch || !varMatch[1]) break;
    const resolved = rootVars.get(varMatch[1]);
    if (!resolved) break; // Cannot resolve further — keep the var() as-is
    current = resolved.trim();
  }
  return current;
}

/**
 * Build override block that forces the imported theme's palette onto Vditor's
 * editor surface. Without this, a dark Typora theme imported at, say,
 * "opencode" would render on top of Vditor's default light background because
 * our chrome-theme heuristic only treats the literal key "dark" as dark.
 */
function buildScopedOverrides(
  themeKey: string | undefined,
  body: BodyColors
): string {
  if (!themeKey) return "";
  const lines: string[] = [];
  if (body.background) {
    lines.push(`  --panel-background-color: ${body.background};`);
    lines.push(`  --textarea-background-color: ${body.background};`);
    lines.push(`  --toolbar-background-color: ${body.background};`);
    lines.push(`  background-color: ${body.background};`);
  }
  if (body.color) {
    lines.push(`  --textarea-text-color: ${body.color};`);
    lines.push(`  color: ${body.color};`);
  }
  if (lines.length === 0) return "";
  const sel = `body[data-content-theme="${cssEscape(themeKey)}"]`;
  // Using `body[data-content-theme]` guarantees these only apply when this
  // theme is active. We cover:
  // - `.vditor` for the chrome (toolbar bg, panel bg)
  // - `.vditor-reset` for the content area
  // - `.vditor-ir pre.vditor-reset` directly for the IR editor pane
  // - `.vditor .vditor-toolbar` for the toolbar element
  let result = `
/* OolongNoteDock: palette imported from the original body { ... } block. */
${sel} .vditor,
${sel} .vditor-reset {
${lines.join("\n")}
}
`;
  if (body.background) {
    result += `${sel} .vditor-ir pre.vditor-reset,
${sel} .vditor-ir pre.vditor-reset:focus {
  background-color: ${body.background};${body.color ? `\n  color: ${body.color};` : ""}
}
${sel} .vditor .vditor-toolbar {
  background-color: ${body.background};
}
`;
  }
  return result;
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/**
 * Determine the recommended Vditor chrome theme based on the background color's
 * perceived luminance. Returns a CSS comment header that the frontend reads.
 *
 * Format: `/* @ond-chrome: dark *\/\n` or `/* @ond-chrome: classic *\/\n`
 * If the color cannot be determined, defaults to no marker (frontend falls back
 * to its own heuristic).
 */
function detectChromeHint(background: string | undefined): string {
  if (!background) return "";
  const dark = isDarkColor(background);
  if (dark === null) return ""; // unrecognized format
  const hint = dark ? "dark" : "classic";
  return `/* @ond-chrome: ${hint} */\n`;
}

/**
 * Return true if a CSS color value appears perceptually "dark" (luminance < 0.5).
 * Supports #hex (3/4/6/8 digit), rgb()/rgba(). Returns null for unrecognized formats.
 */
function isDarkColor(value: string): boolean | null {
  const trimmed = value.trim();
  // #RGB, #RRGGBB, #RGBA, #RRGGBBAA
  const hexMatch = /^#([0-9a-fA-F]{3,8})$/.exec(trimmed);
  if (hexMatch && hexMatch[1]) {
    const hex = hexMatch[1];
    let r: number, g: number, b: number;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0]! + hex[0]!, 16);
      g = parseInt(hex[1]! + hex[1]!, 16);
      b = parseInt(hex[2]! + hex[2]!, 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }
  // rgb(r, g, b) / rgba(r, g, b, a)
  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(trimmed);
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }
  // Named colors — only cover the most common ones for theme backgrounds
  const named: Record<string, boolean> = {
    black: true, white: false, transparent: false,
  };
  const lower = trimmed.toLowerCase();
  if (lower in named) return named[lower]!;
  return null; // Cannot determine
}

/** HTML element names that Typora themes typically style at the bare-tag level. */
const BARE_ELEMENT_NAMES = new Set([
  "a", "blockquote", "code", "del", "em", "figure", "figcaption", "h1", "h2",
  "h3", "h4", "h5", "h6", "hr", "img", "ins", "kbd", "li", "mark", "ol", "p",
  "pre", "q", "s", "samp", "span", "strong", "sub", "sup", "table", "tbody",
  "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
]);

/**
 * Prefix every bare-HTML-tag selector with `.vditor-reset ` so the imported
 * theme wins specificity against Vditor's own scoped rules (e.g.
 * `.vditor-ir pre.vditor-reset` beats `pre` 0,0,1 < 0,2,1).
 *
 * We only rewrite the FIRST compound selector of each comma-separated group;
 * later compounds inherit the scope. Already-scoped selectors (those that
 * contain `.vditor` anywhere, or start with `:root`, `@`-rule, a class, an id)
 * are untouched.
 */
function scopeBareElementSelectors(css: string): string {
  // Replace selector lists before each `{`. Block bodies are left alone.
  return css.replace(
    /(^|[;}])\s*([^{}@;][^{}]*?)\s*\{/g,
    (match, lead: string, selectorList: string) => {
      // Skip @-rules: their "selector" is like `@media (...)`.
      const trimmed = selectorList.trim();
      if (trimmed.startsWith("@") || !trimmed) return match;
      const rewritten = trimmed
        .split(",")
        .map((sel) => scopeOneSelector(sel.trim()))
        .join(", ");
      return `${lead}\n${rewritten} {`;
    }
  );
}

function scopeOneSelector(selector: string): string {
  if (!selector) return selector;
  // If selector already references .vditor-reset / .vditor, leave it.
  if (/\.vditor(-reset)?\b/.test(selector)) return selector;
  // :root and &-like combinators are passthrough.
  if (selector.startsWith(":root") || selector.startsWith("&")) return selector;

  // Isolate the first compound selector (up to whitespace / combinator).
  const firstMatch = /^([^\s>+~]+)/.exec(selector);
  if (!firstMatch) return selector;
  const first = firstMatch[1];
  // Extract the leading tag name, stripping pseudo (`::before`, `:hover`) and
  // attribute/class/id parts.
  const tagMatch = /^([a-zA-Z][a-zA-Z0-9]*)/.exec(first || "");
  if (!tagMatch) return selector; // Starts with . # * [ — already scoped / universal.
  const tag = (tagMatch[1] || "").toLowerCase();
  if (!BARE_ELEMENT_NAMES.has(tag)) return selector;
  return `.vditor-reset ${selector}`;
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

  const themeName = path
    .basename(sourceUri.fsPath, ".css")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  const converted = convertTyporaCss(rawCss, themeName);

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
