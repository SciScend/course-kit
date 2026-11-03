// Keep the reader's place when a view mode changes the layout (ModeToggles.vue).
// Present makes the text bigger and hides the side panels, Notes shows or hides
// the trainer boxes: the page reflows and the same scrollY shows another place.
// So, just before the change, remember the line of text under the nav bar - which
// element, and how far into it - and after it, scroll that same point back under
// the nav bar. Code editors, images and fonts may still resize a moment later, so
// the place is applied again while the page keeps changing (up to SETTLE_MS),
// unless the reader scrolls first.

// from coarse to fine: the last one (in page order) that holds the line wins, so
// a code line beats its code block, a list item its list
const BLOCKS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dt', 'dd', 'tr', 'pre', 'img',
  'svg', 'video', 'iframe', 'blockquote', '.custom-block', '.run-code-output > div',
  'pre .line', '.cm-line'
].map(s => '.vp-doc ' + s).join(', ')
const SETTLE_MS = 600
const STOP_ON = ['wheel', 'touchstart', 'mousedown', 'keydown']

let stopSettle = null

// shown on screen: not in a closed <details> (Chromium keeps a layout box for its
// content, at the place of the content that follows it) and not display: none
function shown(el) {
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) {
    if (!d.open && !el.closest('summary')) return false
  }
  return el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0
}

// just under the nav bar (not VitePress' getScrollOffset(): it is 134px, lower
// than the 64px nav bar, so the top lines on screen would still move)
function readingLine() {
  const nav = document.querySelector('.VPNav')
  return (nav ? nav.getBoundingClientRect().bottom : 64) + 8
}

function takePlace() {
  const line = readingLine()
  let holds = null      // the finest element across the line
  let below = null      // else the first one below it (the line is in a gap)
  for (const el of document.querySelectorAll(BLOCKS)) {
    if (!shown(el)) continue
    const r = el.getBoundingClientRect()
    if (r.height === 0) continue                 // folded code lines
    if (r.top <= line && r.bottom > line) holds = el
    else if (!below && r.top > line) below = el
  }
  if (holds) {
    const r = holds.getBoundingClientRect()
    return { el: holds, frac: (line - r.top) / r.height, gap: 0 }
  }
  if (below) return { el: below, frac: 0, gap: below.getBoundingClientRect().top - line }
  return null
}

function applyPlace(place) {
  if (!place.el.isConnected) return
  const r = place.el.getBoundingClientRect()
  const delta = r.top + place.frac * r.height - place.gap - readingLine()
  if (Math.abs(delta) >= 1) window.scrollBy(0, delta)
}

function restorePlace(place) {
  stopSettle?.()
  applyPlace(place)                              // reading the box forces the new layout
  const ro = new ResizeObserver(() => applyPlace(place))
  const doc = document.querySelector('.vp-doc')
  if (doc) ro.observe(doc)
  const stop = () => {
    ro.disconnect()
    clearTimeout(timer)
    for (const ev of STOP_ON) window.removeEventListener(ev, stop, true)
    stopSettle = null
  }
  const timer = setTimeout(stop, SETTLE_MS)
  for (const ev of STOP_ON) window.addEventListener(ev, stop, true)
  stopSettle = stop
}

// run `change` (it changes the layout) and keep the reader's place
export function keepPlace(change) {
  const place = window.scrollY > 0 ? takePlace() : null    // at the top: stay there
  change()
  if (place) restorePlace(place)
}
