// In-webview Ctrl+F find overlay.
//
// Why this exists: VS Code's CustomTextEditor webviews don't get the
// enableFindWidget option (it only exists on createWebviewPanel), and Vditor
// itself has no in-document find UI in IR/preview mode. So Ctrl+F does
// nothing by default. We provide our own.
//
// Implementation choice: CSS Custom Highlight API (CSS.highlights). This
// renders highlight overlays without mutating the DOM, which is essential —
// IR mode content is contenteditable, and wrapping <mark> elements would
// confuse Vditor's input pipeline and could fire spurious change events.

interface FindState {
  matches: Range[]
  currentIndex: number
  query: string
  caseSensitive: boolean
}

const state: FindState = {
  matches: [],
  currentIndex: -1,
  query: '',
  caseSensitive: false,
}

let overlay: HTMLDivElement | null = null
let inputEl: HTMLInputElement | null = null
let countEl: HTMLSpanElement | null = null
let caseBtn: HTMLButtonElement | null = null
let highlight: any = null
let currentHighlight: any = null
let mutationObserver: MutationObserver | null = null
let refreshTimer: any = null

function ensureHighlights(): boolean {
  const w = window as any
  if (!w.CSS || typeof w.CSS.highlights === 'undefined' || typeof w.Highlight === 'undefined') {
    return false
  }
  if (!highlight) {
    highlight = new w.Highlight()
    currentHighlight = new w.Highlight()
    w.CSS.highlights.set('ond-find', highlight)
    w.CSS.highlights.set('ond-find-current', currentHighlight)
  }
  return true
}

function getSearchRoot(): HTMLElement {
  // .vditor-content covers IR / WYSIWYG / preview / both modes.
  // Fallback to #app if the editor isn't ready yet.
  return (
    (document.querySelector('.vditor-content') as HTMLElement | null) ||
    (document.getElementById('app') as HTMLElement | null) ||
    document.body
  )
}

function clearHighlights(): void {
  if (highlight) highlight.clear()
  if (currentHighlight) currentHighlight.clear()
}

function performSearch(): void {
  state.matches = []
  state.currentIndex = -1
  clearHighlights()
  if (!state.query) {
    updateCount()
    return
  }
  if (!ensureHighlights()) {
    if (countEl) countEl.textContent = 'unsupported'
    return
  }
  const root = getSearchRoot()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      // Skip toolbars, panels, our own overlay, scripts, styles, etc.
      if (
        parent.closest(
          '.vditor-toolbar, .vditor-panel, .vditor-hint, .vditor-tooltipped, .vditor-counter, .ond-find-bar, script, style'
        )
      ) {
        return NodeFilter.FILTER_REJECT
      }
      // Skip empty text nodes
      if (!(node as Text).data || !(node as Text).data.trim()) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const q = state.caseSensitive ? state.query : state.query.toLowerCase()
  let node: Node | null
  while ((node = walker.nextNode())) {
    const t = node as Text
    const haystack = state.caseSensitive ? t.data : t.data.toLowerCase()
    let idx = 0
    while ((idx = haystack.indexOf(q, idx)) !== -1) {
      try {
        const range = document.createRange()
        range.setStart(t, idx)
        range.setEnd(t, idx + q.length)
        state.matches.push(range)
        highlight.add(range)
      } catch {
        // ignore — node may have been mutated underneath us
      }
      idx += q.length
    }
  }
  if (state.matches.length > 0) {
    setCurrent(0)
  } else {
    updateCount()
  }
}

function setCurrent(i: number): void {
  if (state.matches.length === 0) {
    state.currentIndex = -1
    if (currentHighlight) currentHighlight.clear()
    updateCount()
    return
  }
  const len = state.matches.length
  state.currentIndex = ((i % len) + len) % len
  currentHighlight.clear()
  const range = state.matches[state.currentIndex]
  try {
    currentHighlight.add(range)
  } catch {
    // range invalidated; nothing more to do
  }
  // Scroll the match into view. We use the parent element since Range has
  // no scrollIntoView, and clientRect-based math fights with Vditor's own
  // scroll containers.
  const anchor = (range.startContainer.parentElement as HTMLElement | null) || null
  if (anchor) {
    try {
      anchor.scrollIntoView({ block: 'center', inline: 'nearest' })
    } catch {
      // older browsers — silently ignore
    }
  }
  updateCount()
}

function updateCount(): void {
  if (!countEl) return
  if (!state.query) {
    countEl.textContent = ''
  } else if (state.matches.length === 0) {
    countEl.textContent = '0/0'
  } else {
    countEl.textContent = `${state.currentIndex + 1}/${state.matches.length}`
  }
}

function next(): void {
  setCurrent(state.currentIndex + 1)
}
function prev(): void {
  setCurrent(state.currentIndex - 1)
}

function buildOverlay(): void {
  overlay = document.createElement('div')
  overlay.className = 'ond-find-bar'
  overlay.setAttribute('data-ond-skip', '1')
  overlay.innerHTML = `
    <input type="text" class="ond-find-input" spellcheck="false" autocomplete="off" placeholder="Find" />
    <span class="ond-find-count" aria-live="polite"></span>
    <button class="ond-find-btn ond-find-case" data-action="case" title="Match Case (Alt+C)">Aa</button>
    <button class="ond-find-btn" data-action="prev" title="Previous (Shift+Enter)">&#x25B2;</button>
    <button class="ond-find-btn" data-action="next" title="Next (Enter)">&#x25BC;</button>
    <button class="ond-find-btn" data-action="close" title="Close (Esc)">&#x2715;</button>
  `
  document.body.appendChild(overlay)
  inputEl = overlay.querySelector('.ond-find-input') as HTMLInputElement
  countEl = overlay.querySelector('.ond-find-count') as HTMLSpanElement
  caseBtn = overlay.querySelector('.ond-find-case') as HTMLButtonElement

  inputEl.addEventListener('input', () => {
    state.query = inputEl!.value
    performSearch()
  })
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (state.matches.length === 0 && state.query) {
        performSearch()
      } else if (e.shiftKey) {
        prev()
      } else {
        next()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      hideOverlay()
    } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault()
      toggleCase()
    }
  })

  overlay.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.ond-find-btn') as HTMLElement | null
    if (!btn) return
    const action = btn.dataset.action
    if (action === 'next') next()
    else if (action === 'prev') prev()
    else if (action === 'close') hideOverlay()
    else if (action === 'case') toggleCase()
    inputEl!.focus()
  })
}

function toggleCase(): void {
  state.caseSensitive = !state.caseSensitive
  if (caseBtn) {
    caseBtn.classList.toggle('ond-find-active', state.caseSensitive)
  }
  performSearch()
}

function showOverlay(): void {
  if (!overlay) buildOverlay()
  overlay!.style.display = 'flex'
  // Pre-fill with current selection if it's short and on a single line
  try {
    const sel = document.getSelection()
    if (sel && !sel.isCollapsed) {
      const text = sel.toString()
      if (text && text.length < 200 && !/\n/.test(text)) {
        inputEl!.value = text
        state.query = text
        performSearch()
      }
    }
  } catch {
    // ignore
  }
  inputEl!.focus()
  inputEl!.select()
  attachMutationObserver()
}

function hideOverlay(): void {
  if (!overlay) return
  overlay.style.display = 'none'
  state.query = ''
  state.matches = []
  state.currentIndex = -1
  clearHighlights()
  updateCount()
  detachMutationObserver()
}

function isOpen(): boolean {
  return !!overlay && overlay.style.display !== 'none'
}

function attachMutationObserver(): void {
  if (mutationObserver) return
  const root = getSearchRoot()
  mutationObserver = new MutationObserver(() => {
    if (!isOpen() || !state.query) return
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      // Preserve approximate position when re-searching after edits
      const prevIndex = state.currentIndex
      performSearch()
      if (state.matches.length > 0 && prevIndex >= 0) {
        setCurrent(Math.min(prevIndex, state.matches.length - 1))
      }
    }, 200)
  })
  mutationObserver.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

function detachMutationObserver(): void {
  if (mutationObserver) {
    mutationObserver.disconnect()
    mutationObserver = null
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

export function setupFind(): void {
  document.addEventListener(
    'keydown',
    (e) => {
      const mod = e.ctrlKey || e.metaKey
      // Ctrl+F / Cmd+F → open
      if (mod && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        e.stopPropagation()
        showOverlay()
        return
      }
      // F3 / Ctrl+G → next (shift = prev), only when overlay is open
      if (isOpen() && (e.key === 'F3' || (mod && (e.key === 'g' || e.key === 'G')))) {
        e.preventDefault()
        e.stopPropagation()
        if (e.shiftKey) prev()
        else next()
        return
      }
      // Esc anywhere closes the overlay if it's open
      if (isOpen() && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        hideOverlay()
        return
      }
    },
    true // capture phase — beat Vditor's own keydown handlers
  )
}
