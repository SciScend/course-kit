<script setup>
// Drag handles that resize the left navigation and the right "In this lecture" column.
// - Drag a handle to make the panel narrower or wider, in any step, down to 0.
// - At (almost) 0 the panel is hidden; a small tab stays at the edge of the window.
// - Click the tab, or drag it out, to show the panel again.
// - With the handle focused (click it, or Tab to it): Left / Right arrows change
//   the width in steps of 16px (Shift: 64px).
// - Double-click a handle to go back to the default width.
// Widths and hidden panels are remembered per browser.
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vitepress'

const STORAGE_KEY = 'ck-panel-widths'
const HIDE_BELOW = 24        // narrower than this the panel is hidden
const RESTORE_MIN = 120      // a panel shown again by a click gets at least this width
const STEP = 16              // arrow key step (Shift: 4 x STEP)
// the window width from which the "In this page" column is shown (asideMinWidth in config.mjs)
const ASIDE_MIN_WIDTH = typeof __CK_ASIDE_MIN_WIDTH__ !== 'undefined' ? __CK_ASIDE_MIN_WIDTH__ : 1280
const panels = {
  sidebar: { cssVar: '--vp-sidebar-width', hideClass: 'ck-hide-sidebar', def: 272, min: 0, max: 640, dir: 1, minViewport: 960 },
  aside: { cssVar: '--ck-aside-width', hideClass: 'ck-hide-aside', def: 256, min: 0, max: 640, dir: -1, minViewport: ASIDE_MIN_WIDTH }
}

const widths = { sidebar: panels.sidebar.def, aside: panels.aside.def }
const hidden = ref({ sidebar: false, aside: false })
const pos = ref({ sidebar: null, aside: null })   // { left, top } or null when there is no handle
const dragging = ref(null)
const route = useRoute()
let drag = null
let observer = null

function setWidth(name, value) {
  const p = panels[name]
  widths[name] = Math.round(Math.min(p.max, Math.max(p.min, value)))
  document.documentElement.style.setProperty(p.cssVar, widths[name] + 'px')
}

function setHidden(name, value) {
  hidden.value = { ...hidden.value, [name]: value }
  document.documentElement.classList.toggle(panels[name].hideClass, value)
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...widths, hidden: hidden.value }))
  } catch (e) { /* not remembered */ }
}

function shown(el) {
  return !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none'
}

// x of the grey line on the left of the outline; without an outline, where it would be
function asideLine(aside) {
  const outline = aside.querySelector('.VPDocAsideOutline .content')
  if (outline && shown(outline)) return outline.getBoundingClientRect().left
  return aside.getBoundingClientRect().left + parseFloat(getComputedStyle(aside).paddingLeft || 0)
}

function place() {
  const root = document.documentElement
  const vw = root.clientWidth
  const navHeight = document.querySelector('.VPNav')?.getBoundingClientRect().height || 64
  const present = root.classList.contains('present')
  const sidebar = document.querySelector('.VPSidebar')
  const aside = document.querySelector('.VPDoc .aside')
  const next = { sidebar: null, aside: null }

  if (!present && sidebar && vw >= panels.sidebar.minViewport) {
    if (hidden.value.sidebar) next.sidebar = { left: 0, top: navHeight }
    else if (shown(sidebar)) next.sidebar = { left: sidebar.getBoundingClientRect().right - 4, top: navHeight }
  }
  if (!present && aside && vw >= panels.aside.minViewport) {
    if (hidden.value.aside) next.aside = { left: vw - 10, top: navHeight }
    // the handle's line (3px from its left side) on the grey line left of the outline
    else if (shown(aside)) next.aside = { left: asideLine(aside) - 4, top: navHeight }
  }
  pos.value = next
}

function start(name, e) {
  e.preventDefault()
  e.currentTarget.focus()
  drag = { name, startX: e.clientX, startWidth: hidden.value[name] ? 0 : widths[name], moved: false }
  dragging.value = name
  document.documentElement.classList.add('ck-resizing')
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
}

function move(e) {
  if (!drag) return
  const dx = e.clientX - drag.startX
  if (Math.abs(dx) > 3) drag.moved = true
  if (!drag.moved) return
  resize(drag.name, drag.startWidth + panels[drag.name].dir * dx, drag.startWidth)
}

// the new width of a panel; below HIDE_BELOW it is hidden
function resize(name, value, widthBefore) {
  if (value < HIDE_BELOW) {
    setHidden(name, true)
    // a click on the tab later brings back the width from before
    setWidth(name, Math.max(widthBefore, RESTORE_MIN))
  } else {
    setHidden(name, false)
    setWidth(name, value)
  }
  place()
}

function onKey(name, e) {
  const p = panels[name]
  const step = e.shiftKey ? 4 * STEP : STEP
  let delta = 0
  if (e.key === 'ArrowRight') delta = step * p.dir
  if (e.key === 'ArrowLeft') delta = -step * p.dir
  if (!delta) return
  e.preventDefault()
  e.stopPropagation()
  if (hidden.value[name]) {
    // from hidden, the first step outwards shows the panel at its narrowest
    if (delta > 0) resize(name, Math.max(HIDE_BELOW, delta), widths[name])
  } else {
    resize(name, widths[name] + delta, widths[name])
  }
  save()
}

function stop() {
  if (drag && !drag.moved && hidden.value[drag.name]) {
    setHidden(drag.name, false)   // a click on the tab shows the panel again
  }
  drag = null
  dragging.value = null
  document.documentElement.classList.remove('ck-resizing')
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', stop)
  save()
  nextTick(place)
}

function reset(name) {
  setHidden(name, false)
  setWidth(name, panels[name].def)
  save()
  nextTick(place)
}

function title(name) {
  const what = name === 'sidebar' ? 'the navigation' : 'the "In this lecture" column'
  return hidden.value[name]
    ? `Click or drag to show ${what}`
    : `Drag (or use the Left / Right arrows) to resize ${what}; at 0 it is hidden. Double-click to reset.`
}

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    for (const name of Object.keys(panels)) {
      if (typeof saved[name] === 'number') setWidth(name, saved[name])
      if (saved.hidden && saved.hidden[name]) setHidden(name, true)
    }
  } catch (e) { /* defaults */ }
  window.addEventListener('resize', place)
  // the panels appear / disappear with the page, Present mode and the window size
  observer = new MutationObserver(() => requestAnimationFrame(place))
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  setTimeout(place, 50)
})

watch(() => route.path, () => nextTick(() => setTimeout(place, 50)))

onBeforeUnmount(() => {
  window.removeEventListener('resize', place)
  observer && observer.disconnect()
  stop()
})
</script>

<template>
  <div
    v-for="name in ['sidebar', 'aside']"
    v-show="pos[name]"
    :key="name"
    class="ck-resize-handle"
    :class="[name, { active: dragging === name, collapsed: hidden[name] }]"
    :style="pos[name] ? { left: pos[name].left + 'px', top: pos[name].top + 'px' } : {}"
    :title="title(name)"
    tabindex="0"
    @pointerdown="start(name, $event)"
    @keydown="onKey(name, $event)"
    @dblclick="reset(name)"
  >
    <span v-if="hidden[name]" class="ck-tab" />
  </div>
</template>
