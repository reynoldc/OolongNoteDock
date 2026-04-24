import { keyboard } from '@testing-library/user-event/dist/keyboard'
import $ from 'jquery'
require('jquery-confirm')(window, $)
import 'jquery-confirm/css/jquery-confirm.css'

import _ from 'lodash'
import Vditor from 'vditor'
window.vscode =
  (window as any).acquireVsCodeApi && (window as any).acquireVsCodeApi()
;(window as any).global = window

declare global {
  export const vditor: Vditor
  export const vscode: any
  interface Window {
    vditor: Vditor
    vscode: any
    global: Window
  }
}

export function confirm(msg, onOk) {
  $.confirm({
    title: '',
    animation: 'top',
    closeAnimation: 'top',
    animateFromElement: false,
    boxWidth: '300px',
    useBootstrap: false,
    content: msg,
    buttons: {
      cancel: {
        text: 'Cancel',
      },
      confirm: {
        text: 'Confirm',
        action: onOk,
      },
    },
  })
}
// 切换 content-theme 时自动修改 vditor theme
export function fixDarkTheme() {
  let $ct = document.querySelector('[data-type="content-theme"]')
  $ct.nextElementSibling.addEventListener('click', (e) => {
    if ((e.target as any).tagName !== 'BUTTON') return
    let type = (e.target as any).getAttribute('data-type')
    if (type === 'dark') {
      vditor.setTheme(type)
    } else {
      vditor.setTheme('classic')
    }
  })
}
// panel hover 加定时延迟
export function fixPanelHover() {
  $('.vditor-panel').each((i, e) => {
    let timer
    $(e)
      .on('mouseenter', (e) => {
        timer && clearTimeout(timer)
        e.currentTarget.classList.add('vditor-panel_hover')
      })
      .on('mouseleave', (e) => {
        let el = e.currentTarget
        timer = setTimeout(() => {
          el.classList.remove('vditor-panel_hover')
        }, 2000)
      })
  })
}
// 文件转base64用于传输
export const fileToBase64 = async (file) => {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = function (evt) {
      res(evt.target.result.toString().split(',')[1])
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}
// 保存 vditor 配置到 vscode 同步存储
// Only save serializable user preferences, NOT session-specific paths
export function saveVditorOptions() {
  const opts = vditor.vditor.options
  const vditorOptions = {
    theme: opts.theme,
    mode: vditor.vditor.currentMode,
    preview: {
      theme: {
        current: opts.preview && opts.preview.theme
          ? opts.preview.theme.current
          : undefined,
      },
    },
  }
  vscode.postMessage({
    command: 'save-options',
    options: vditorOptions,
  })
}
// toolbar 点击时保存配置（使用事件委托捕获所有面板按钮）
let vditorReady = false
export function markVditorReady() {
  vditorReady = true
}
export function resetVditorReady() {
  vditorReady = false
}

// Suppress the next save triggered by content-theme change — used when we
// apply a theme broadcast from another tab, so we don't re-broadcast it.
let suppressThemeSave = false
export function beginSuppressThemeSave(ms = 500) {
  suppressThemeSave = true
  setTimeout(() => { suppressThemeSave = false }, ms)
}

export function handleToolbarClick() {
  $(document).on('click', '.vditor-toolbar button, .vditor-hint button, .vditor-panel button', () => {
    if (!vditorReady) return
    setTimeout(() => {
      saveVditorOptions()
    }, 500)
  })
}

// Watch content-theme changes. This is tricky because Vditor's panel buttons:
//   1. Call event.stopPropagation() in bubble phase, blocking jQuery delegation.
//   2. Invoke the module-level setContentTheme (not vditor.setContentTheme),
//      which REMOVES the old <link id="vditorContentTheme"> and inserts a new
//      one. So observing the old element's attributes captures nothing.
//
// We use two complementary mechanisms:
//   (a) Capture-phase click listener on document — runs BEFORE Vditor's
//       stopPropagation and never misses the button click.
//   (b) MutationObserver on <head> childList — catches the link element
//       replacement regardless of how it was triggered.
export function watchContentThemeChange() {
  const triggerSave = (reason: string): void => {
    if (!vditorReady) return
    if (suppressThemeSave) return
    console.log('[OND] theme change detected via', reason)
    // Mirror the current content theme to body[data-content-theme] so main.css
    // can gate the VS Code background override per theme.
    const current = vditor && vditor.vditor && vditor.vditor.options
      && vditor.vditor.options.preview && vditor.vditor.options.preview.theme
      && vditor.vditor.options.preview.theme.current
    if (current) {
      document.body.setAttribute('data-content-theme', current)
    }
    // Debounce so Vditor's internal state (options.preview.theme.current) has
    // settled by the time we read it in saveVditorOptions().
    setTimeout(() => saveVditorOptions(), 50)
  }

  // (a) Capture-phase click on content-theme panel buttons
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null
      if (!target || target.tagName !== 'BUTTON') return
      // The content-theme panel lives as a sibling of the content-theme toolbar
      // item. Walk up to see if this button is inside a vditor-hint panel that
      // follows the content-theme toolbar button.
      const panel = target.closest('.vditor-hint, .vditor-panel') as HTMLElement | null
      if (!panel) return
      const prev = panel.previousElementSibling as HTMLElement | null
      if (prev && prev.getAttribute('data-type') === 'content-theme') {
        triggerSave('capture-click')
      }
    },
    true // capture phase
  )

  // (b) Watch <head> for link element replacement
  const headObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (
          node instanceof HTMLLinkElement &&
          node.id === 'vditorContentTheme'
        ) {
          triggerSave('head-mutation')
          return
        }
      }
    }
  })
  headObserver.observe(document.head, { childList: true })
}

// Monkey-patch vditor.setContentTheme so we catch theme changes regardless of
// how they were triggered (toolbar panel, programmatic call, etc.). The toolbar
// panel buttons call event.stopPropagation(), so DOM events are unreliable.
export function hookSetContentTheme() {
  // Vditor 3.x does not expose an instance setContentTheme method; the toolbar
  // panel calls the internal module-level one directly. We rely on
  // watchContentThemeChange() for detection instead. Kept as a no-op to avoid
  // breaking any external callers.
}

export function fixLinkClick() {
  const openLink = (url: string) => {
    vscode.postMessage({ command: 'open-link', href: url })
  }
  document.addEventListener('click', e=> {
    let el = e.target as HTMLAnchorElement
    if (el.tagName === 'A') {
      openLink(el.href)
    }
  })
  window.open = (url: string, ...args: any[]) => {
    openLink(url)
    return window
  }
}


/** error:
 We don't execute document.execCommand() this time, because it is called recursively.
(anonymous) @ main.js:32449
(anonymous) @ main.js:842
(anonymous) @ host.js:27
see: https://github.com/nwjs/nw.js/issues/3403 */
export function fixCut() {
  let _exec = document.execCommand.bind(document)
  document.execCommand = (cmd, ...args) => {
    if (cmd === 'delete') {
      setTimeout(() => {
        return _exec(cmd, ...args)
      })
    } else {
      return _exec(cmd, ...args)
    }
  }
}
