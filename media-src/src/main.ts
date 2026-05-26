import './preload'

import {
  fileToBase64,
  fixCut,
  fixDarkTheme,
  fixLinkClick,
  fixPanelHover,
  fixPreviewCopy,
  handleToolbarClick,
  markVditorReady,
  resetVditorReady,
  saveVditorOptions,
  watchContentThemeChange,
  beginSuppressThemeSave,
} from './utils'

import { merge } from 'lodash'
import Vditor from 'vditor'
import { format } from 'date-fns'
import 'vditor/dist/index.css'
import { t, lang } from './lang'
import { toolbar } from './toolbar'
import { fixTableIr } from './fix-table-ir'
import { setupFind } from './find'
import './main.css'

function initVditor(msg) {
  console.log('msg', msg)
  let inputTimer
  let defaultOptions: any = {}

  // Track which imported themes should use dark chrome. The built-in "dark"
  // theme is always dark; user-imported themes carry an @ond-chrome hint that
  // the backend resolves at scan time.
  const darkThemes: Set<string> = new Set(['dark', ...(msg.darkThemes || [])])
  ;(window as any).__ondDarkThemes = darkThemes

  // User-facing display preferences from extension settings.
  const defaultOpenMode: 'edit' | 'preview' =
    msg.defaultOpenMode === 'preview' ? 'preview' : 'edit'
  const autoOpenOutline: boolean = msg.autoOpenOutline === true

  const themeList = {
    "dark": "Dark",
    "github": "GitHub",
    "light": "Light",
    "opencode": "Opencode",
    "vue": "Vue",
    "wechat": "WeChat",
    ...(msg.extraThemes || {}),
  }

  // Extract saved content theme before merge (e.g. "github")
  const savedContentTheme = msg.options
    && msg.options.preview
    && msg.options.preview.theme
    && msg.options.preview.theme.current

  // Merge stored options but strip preview (we rebuild it cleanly below)
  const { preview: _stripPreview, ...cleanOptions } = msg.options || {}
  defaultOptions = merge(defaultOptions, cleanOptions, {
    preview: {
      math: { inlineDigit: true },
    }
  })

  // Determine content theme: saved > "opencode" (project default).
  // We intentionally pin the fallback to opencode regardless of VS Code's
  // light/dark setting; users can switch via the content-theme picker.
  const fallbackTheme = 'opencode'
  const contentTheme = savedContentTheme || fallbackTheme

  // Chrome theme follows content theme based on background luminance.
  // darkThemes contains all themes whose CSS was detected as dark-background.
  if (darkThemes.has(contentTheme)) {
    defaultOptions.theme = 'dark'
  } else {
    defaultOptions.theme = 'classic'
  }

  // Set preview.theme with clean data (no stale paths)
  defaultOptions.preview = defaultOptions.preview || {}
  defaultOptions.preview.theme = {
    current: contentTheme,
    list: themeList,
  }

  // Apply outline auto-open setting. We always overwrite, so the global
  // setting fully drives the initial outline state on every document open;
  // toggling outline via the toolbar stays session-only (it's not persisted
  // back to globalState by saveVditorOptions).
  defaultOptions.outline = {
    enable: autoOpenOutline,
    position: 'left',
  }

  // Expose the current content theme as a data attribute so main.css can
  // decide whether to override the Vditor palette with VS Code's background.
  document.body.setAttribute('data-content-theme', contentTheme)

  if (window.vditor) {
    resetVditorReady()
    vditor.destroy()
    window.vditor = null
  }
  window.vditor = new Vditor('app', {
    width: '100%',
    height: '100%',
    minHeight: '100%',
    lang,
    value: msg.content,
    mode: 'ir',
    tab: '\t',
    cdn: msg.cdn || undefined,
    cache: { enable: false },
    toolbar,
    toolbarConfig: { pin: true },
    ...defaultOptions,
    after() {
      fixDarkTheme()
      handleToolbarClick()
      fixTableIr()
      fixPanelHover()
      watchContentThemeChange()
      // Nudge the content-theme <link> after layout is stable. Vditor's
      // initUI calls setContentTheme synchronously during DOM construction,
      // so on first load the IR content can be laid out before the theme CSS
      // is applied. We re-insert the same <link> so the browser applies the
      // cached CSS against the now-complete DOM. This does NOT call
      // vditor.setTheme (which would re-render content and cause flashes).
      setTimeout(() => {
        try {
          const link = document.getElementById('vditorContentTheme') as HTMLLinkElement | null
          if (link && link.href) {
            const href = link.href
            const newLink = document.createElement('link')
            newLink.id = 'vditorContentTheme'
            newLink.rel = 'stylesheet'
            newLink.type = 'text/css'
            newLink.href = href
            // Suppress our own head-mutation observer — otherwise this triggers
            // saveVditorOptions and an unintended broadcast.
            beginSuppressThemeSave(1500)
            link.remove()
            document.head.appendChild(newLink)
            console.log('[OND] after(): nudged content-theme link')
          }
        } catch (err) {
          console.error('[OND] nudge content-theme failed', err)
        }
      }, 50)
      // Mark ready after all init is done, so observers don't fire during setup
      setTimeout(() => markVditorReady(), 300)

      // If the project is configured to open documents in preview mode, click
      // the preview toolbar button after Vditor is ready. We do this rather
      // than calling Vditor's internal preview-render directly because the
      // toolbar button handler also handles disabling other toolbar items
      // and showing the "current" highlight, keeping the UI consistent with
      // a manual click.
      if (defaultOpenMode === 'preview') {
        setTimeout(() => {
          try {
            const previewBtn = document.querySelector(
              '[data-type="preview"]'
            ) as HTMLElement | null
            if (previewBtn) previewBtn.click()
          } catch (err) {
            console.error('[OND] auto preview-mode failed', err)
          }
        }, 350)
      }
    },
    input() {
      if (suppressInput) return
      inputTimer && clearTimeout(inputTimer)
      inputTimer = setTimeout(() => {
        vscode.postMessage({ command: 'edit', content: vditor.getValue() })
      }, 100)
    },
    upload: {
      url: '/fuzzy', // 没有 url 参数粘贴图片无法上传 see: https://github.com/Vanessa219/vditor/blob/d7628a0a7cfe5d28b055469bf06fb0ba5cfaa1b2/src/ts/util/fixBrowserBehavior.ts#L1409
      async handler(files) {
        // console.log('files', files)
        let fileInfos = await Promise.all(
          files.map(async (f) => {
            const d = new Date()
            return {
              base64: await fileToBase64(f),
              name: `${format(new Date(), 'yyyyMMdd_HHmmss')}_${f.name}`.replace(
                /[^\w-_.]+/,
                '_'
              ),
            }
          })
        )
        vscode.postMessage({
          command: 'upload',
          files: fileInfos,
        })
      },
    },
  })
}

function applyRemoteTheme(options: any) {
  if (!vditor) return false
  const opts = options || {}
  const contentTheme = opts.preview && opts.preview.theme && opts.preview.theme.current
  beginSuppressThemeSave(1000)
  if (contentTheme) {
    try {
      const vOpts: any = vditor.vditor && vditor.vditor.options
      // Chrome theme follows content theme based on luminance-detected dark list.
      const darkThemes: Set<string> = (window as any).__ondDarkThemes || new Set(['dark'])
      const chromeTheme: 'dark' | 'classic' = darkThemes.has(contentTheme) ? 'dark' : 'classic'
      let path = vOpts && vOpts.preview && vOpts.preview.theme && vOpts.preview.theme.path
      if (!path) {
        const linkEl = document.getElementById('vditorContentTheme') as HTMLLinkElement | null
        if (linkEl && linkEl.href) {
          path = linkEl.href.replace(/\/[^/]+\.css(?:\?.*)?$/, '')
        }
      }
      console.log('[OND] applying', contentTheme, 'path=', path)
      document.body.setAttribute('data-content-theme', contentTheme)
      vditor.setTheme(chromeTheme, contentTheme, undefined, path)
    } catch (error) {
      console.error('sync content theme failed', error)
    }
  }
  return true
}

// Buffer sync-theme messages that arrive before Vditor finishes initializing.
let pendingSyncTheme: any = null

// Suppress input() callback after external setValue to prevent circular updates.
let suppressInput = false

window.addEventListener('message', (e) => {
  const msg = e.data
  // console.log('msg from vscode', msg)
  switch (msg.command) {
    case 'update': {
      if (msg.type === 'init') {
        if (msg.options && msg.options.useVscodeThemeColor) {
          document.body.setAttribute('data-use-vscode-theme-color', '1')
        } else {
          document.body.setAttribute('data-use-vscode-theme-color', '0')
        }
        try {
          initVditor(msg)
        } catch (error) {
          // reset options when error
          console.error(error)
          initVditor({ content: msg.content })
          saveVditorOptions()
        }
        console.log('initVditor')
        // Flush any sync-theme that arrived before we were ready
        if (pendingSyncTheme) {
          const queued = pendingSyncTheme
          pendingSyncTheme = null
          const tryFlush = (attempt: number): void => {
            if (applyRemoteTheme(queued)) return
            if (attempt < 20) {
              setTimeout(() => tryFlush(attempt + 1), 100)
            }
          }
          setTimeout(() => tryFlush(0), 200)
        }
      } else {
        // Suppress input() callback to prevent the old content being sent back
        suppressInput = true
        vditor.setValue(msg.content)
        // Allow enough time for setValue-triggered input events to be discarded
        setTimeout(() => { suppressInput = false }, 300)
        console.log('setValue')
      }
      break
    }
    case 'sync-theme': {
      console.log('[OND] sync-theme received', msg.options)
      if (!vditor) {
        console.log('[OND] Vditor not ready, buffering')
        pendingSyncTheme = msg.options
        break
      }
      applyRemoteTheme(msg.options)
      break
    }
    case 'update-theme-list': {
      // Rebuild the content-theme panel's button list and Vditor's live
      // options.preview.theme.list so newly imported / deleted themes show up
      // without reopening the tab.
      if (!vditor) break
      try {
        // Update the global dark themes set
        const darkThemes: Set<string> = new Set(['dark', ...(msg.darkThemes || [])])
        ;(window as any).__ondDarkThemes = darkThemes

        const builtIn: Record<string, string> = {
          'dark': 'Dark',
          'github': 'GitHub',
          'light': 'Light',
          'opencode': 'Opencode',
          'vue': 'Vue',
          'wechat': 'WeChat',
        }
        const themeList: Record<string, string> = {
          ...builtIn,
          ...(msg.extraThemes || {}),
        }
        const vOpts: any = vditor.vditor && vditor.vditor.options
        if (vOpts && vOpts.preview && vOpts.preview.theme) {
          vOpts.preview.theme.list = themeList
        }
        // Rebuild panel DOM: the content-theme toolbar button's nextSibling is
        // the panel element (see ContentTheme.ts in Vditor).
        const btn = document.querySelector('[data-type="content-theme"]') as HTMLElement | null
        const panel = btn && btn.nextElementSibling as HTMLElement | null
        if (panel) {
          const inner = panel.querySelector('div') as HTMLDivElement | null
          if (inner) {
            inner.innerHTML = Object.keys(themeList)
              .map((k) => `<button data-type="${k}">${themeList[k]}</button>`)
              .join('')
          }
        }
        console.log('[OND] theme list updated', Object.keys(themeList))
      } catch (err) {
        console.error('[OND] update-theme-list failed', err)
      }
      break
    }
    case 'uploaded': {
      msg.files.forEach((f) => {
        if (f.endsWith('.wav')) {
          vditor.insertValue(
            `\n\n<audio controls="controls" src="${f}"></audio>\n\n`
          )
        } else if (msg.obsidianFormat) {
          // Obsidian format: insert ![[filename]] (Vditor renders it as-is text,
          // but extension converts it to standard markdown on next update cycle)
          const filename = f.split('/').slice(-1)[0]
          vditor.insertValue(`\n\n![${filename}](${f})\n\n`)
        } else {
          const i = new Image()
          i.src = f
          i.onload = () => {
            vditor.insertValue(`\n\n![](${f})\n\n`)
          }
          i.onerror = () => {
            vditor.insertValue(`\n\n[${f.split('/').slice(-1)[0]}](${f})\n\n`)
          }
        }
      })
      break
    }
    default:
      break
  }
})

fixLinkClick()
fixCut()
fixPreviewCopy()
setupFind()

vscode.postMessage({ command: 'ready' })
