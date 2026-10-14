<script setup>
// A code block with "Run", "Edit" and "Reset" buttons.
// The code runs in the browser; console.log output is shown under the block.
// The course's sample data (defineCourse({ data })) is available as `doc`.
import { ref, computed, nextTick } from 'vue'
// 'course-data' is an alias set by defineCourse({ data }); it defaults to an empty object
import sampleAsset from 'course-data'

const props = defineProps({ code: { type: String, required: true } })

function decode(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes).replace(/\n$/, '')
}

const original = decode(props.code)
const source = ref(original)
const editing = ref(false)
const ran = ref(false)
const lines = ref([])
const editor = ref(null)

const changed = computed(() => source.value !== original)
const rows = computed(() => Math.max(3, source.value.split('\n').length + 1))

// Format values roughly like Node.js does in the terminal
function inspect(value, nested = false, depth = 0) {
  if (typeof value === 'string') return nested ? `'${value}'` : value
  if (typeof value === 'bigint') return `${value}n`
  if (value === null || value === undefined || typeof value !== 'object') {
    if (typeof value === 'function') return `[Function: ${value.name || '(anonymous)'}]`
    if (Object.is(value, -0)) return '-0'
    return String(value)
  }
  if (depth > 3) return Array.isArray(value) ? '[Array]' : '[Object]'
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[ ${value.map(v => inspect(v, true, depth + 1)).join(', ')} ]`
  }
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return `${value.name}: ${value.message}`
  const keys = Object.keys(value)
  if (keys.length === 0) return '{}'
  const key = k => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`)
  return `{ ${keys.map(k => `${key(k)}: ${inspect(value[k], true, depth + 1)}`).join(', ')} }`
}

function run() {
  const out = []
  const write = kind => (...args) => out.push({ kind, text: args.map(a => inspect(a)).join(' ') })
  const fakeConsole = { log: write('log'), info: write('log'), warn: write('warn'), error: write('error'), table: write('log') }
  const doc = JSON.parse(JSON.stringify(sampleAsset))
  try {
    // eslint-disable-next-line no-new-func
    new Function("console", "doc", source.value)(fakeConsole, doc)
  } catch (err) {
    out.push({ kind: 'error', text: `${err.name}: ${err.message}` })
  }
  lines.value = out
  ran.value = true
}

async function toggleEdit() {
  editing.value = !editing.value
  if (editing.value) {
    await nextTick()
    editor.value && editor.value.focus()
  }
}

function reset() {
  source.value = original
  lines.value = []
  ran.value = false
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run() }
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.target
    const s = el.selectionStart
    source.value = source.value.slice(0, s) + '    ' + source.value.slice(el.selectionEnd)
    nextTick(() => { el.selectionStart = el.selectionEnd = s + 4 })
  }
}
</script>

<template>
  <div class="run-code" :class="{ editing }">
    <div v-show="!editing && !changed" class="run-code-view"><slot /></div>
    <pre v-show="!editing && changed" class="run-code-plain"><code>{{ source }}</code></pre>
    <textarea
      v-if="editing"
      ref="editor"
      v-model="source"
      class="run-code-editor"
      :rows="rows"
      spellcheck="false"
      @keydown="onKeydown"
    />
    <div class="run-code-bar">
      <button class="run" title="Run (Ctrl+Enter while editing)" @click="run">Run</button>
      <button @click="toggleEdit">{{ editing ? 'Done' : 'Edit' }}</button>
      <button v-if="changed || ran" @click="reset">Reset</button>
      <span class="hint">{{ editing ? 'Ctrl+Enter runs the code' : 'Edit the code and run it again' }}</span>
    </div>
    <div v-if="ran" class="run-code-output">
      <div v-if="lines.length === 0" class="empty">(no output)</div>
      <div v-for="(line, i) in lines" :key="i" :class="line.kind">{{ line.text }}</div>
    </div>
  </div>
</template>
