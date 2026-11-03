// Keep the reader's place when a view mode changes the layout (ModeToggles.vue).
// Present makes the text bigger and hides the side panels, Notes shows or hides
// the trainer boxes: the page reflows and the same scrollY shows another place.
// So, just before the change, remember the line of text under the nav bar - which
// element, and how far into it - and after it, scroll that same point back under
// the nav bar. Code editors, images and fonts may still resize a moment later, so
// the place is applied again while the page keeps changing (up to SETTLE_MS),
// unless the reader scrolls first.
//
// describePlace() / restoreDescribedPlace() do the same across two pages built
// from the same Markdown, as the EN / BG versions of a page: the element is gone
// after the switch, so the place is kept as a path - the section (heading id),
// the n-th block after its heading, and how far into it.

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

// just under the bars at the top (not VitePress' getScrollOffset(): it is 134px,
// lower than the 64px nav bar, so the top lines on screen would still move). On
// phones the nav bar scrolls away with the page and the local bar ("Menu",
// "On this page") sticks to the top instead.
function readingLine() {
  let bottom = 0
  for (const bar of document.querySelectorAll('.VPNav, .VPLocalNav')) {
    const r = bar.getBoundingClientRect()
    if (r.height > 0) bottom = Math.max(bottom, r.bottom)
  }
  return bottom + 8
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
  if (place.described) place = findPlace(place.described) || {}   // again: the page may still fold code
  if (!place.el?.isConnected) return
  const r = place.el.getBoundingClientRect()
  const delta = r.top + place.frac * r.height - place.gap - readingLine()
  if (Math.abs(delta) >= 1) window.scrollBy(0, delta)
}

// `until`: a promise (e.g. document.fonts.ready); the settle time starts after it
function restorePlace(place, until = null) {
  stopSettle?.()
  applyPlace(place)                              // reading the box forces the new layout
  const ro = new ResizeObserver(() => applyPlace(place))
  const doc = document.querySelector('.vp-doc')
  if (doc) ro.observe(doc)
  let timer = null
  let stopped = false
  const stop = () => {
    stopped = true
    ro.disconnect()
    clearTimeout(timer)
    for (const ev of STOP_ON) window.removeEventListener(ev, stop, true)
    stopSettle = null
  }
  Promise.resolve(until).then(() => { if (!stopped) timer = setTimeout(stop, SETTLE_MS) })
  for (const ev of STOP_ON) window.addEventListener(ev, stop, true)
  stopSettle = stop
}

// run `change` (it changes the layout) and keep the reader's place
export function keepPlace(change) {
  const place = window.scrollY > 0 ? takePlace() : null    // at the top: stay there
  change()
  if (place) restorePlace(place)
}

// --- the place as a path, for another page with the same blocks (EN / BG) ---

const SECTIONS = '.vp-doc :is(h1, h2, h3, h4, h5, h6)[id]'
// parts that need not be the same on the other page: run output (only after Run),
// the Edit view of a runnable block, trainer notes (English only)
const SKIP = '.run-code-output, .cm-editor, .trainer-note'

function counted(el) { return !el.closest(SKIP) }

// the section heading of `el` (the last one at or before it), or null: page start
function sectionOf(el) {
  let heading = null
  for (const h of document.querySelectorAll(SECTIONS)) {
    if (!counted(h)) continue
    if (h !== el && !(h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) break
    heading = h
  }
  return heading
}

// the blocks after `heading` (or from the page start), in page order; hidden ones
// too, as the other page may not have folded its code yet
function blocksAfter(heading) {
  return [...document.querySelectorAll(BLOCKS)].filter(el => counted(el) &&
    (!heading || heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))
}

function kind(el) { return el.tagName + (el.classList.contains('line') ? '.line' : '') }

// the line under the nav bar, as plain data; null at the page top
export function describePlace() {
  if (window.scrollY <= 0) return null
  const place = takePlace()
  if (!place) return null
  let { el, frac, gap } = place
  if (!counted(el)) {                            // in run output, a note ...: the block before it
    const before = [...document.querySelectorAll(BLOCKS)]
      .filter(b => counted(b) && shown(b) && b.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !b.contains(el))
    if (!before.length) return null
    el = before[before.length - 1]
    frac = 1
    gap = 0
  }
  const heading = sectionOf(el)
  const index = el === heading ? -1 : blocksAfter(heading).indexOf(el)
  return { section: heading ? heading.id : null, index, kind: kind(el), frac, gap }
}

// find the described block on the page on screen: null if this page has no such
// section, or not the same blocks in it
function findPlace(d) {
  const heading = d.section ? document.getElementById(d.section) : null
  if (d.section && !heading) return null
  let el = d.index < 0 ? heading : blocksAfter(heading)[d.index]
  if (!el || kind(el) !== d.kind) return null
  let { frac, gap } = d
  // hidden here (in a closed <details>): its summary, or the nearest shown block
  while (el && !shown(el)) {
    let closed = null
    for (let x = el.closest('details'); x; x = x.parentElement?.closest('details')) if (!x.open) closed = x
    const summary = closed?.querySelector(':scope > summary')
    el = summary || (closed || el).parentElement?.closest(BLOCKS)
    frac = 0
    gap = 0
  }
  if (!el) return null
  // a code line cut off by a folded block (codeFold.js of the course): the end of the block
  const fold = el.closest('[data-fold="folded"]')
  if (fold && el !== fold && el.getBoundingClientRect().top >= fold.getBoundingClientRect().bottom) {
    return { el: fold, frac: 1, gap: 0 }
  }
  return { el, frac, gap }
}

// scroll the described place under the nav bar; false if it is not on this page.
// `until` as in restorePlace (the other language's fonts may still be loading)
export function restoreDescribedPlace(d, until = null) {
  if (!d || !findPlace(d)) return false
  restorePlace({ described: d }, until)
  return true
}
