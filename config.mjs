import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import container from 'markdown-it-container'

const here = path.dirname(fileURLToPath(import.meta.url))

// ```js run  -> the code block gets "Run" and "Edit" buttons (theme/components/RunCode.vue)
function runnableCode(md) {
  const fence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info.trim().split(/\s+/)
    if (info[0] === 'js' && info.includes('run')) {
      token.info = 'js'
      const code = Buffer.from(token.content, 'utf8').toString('base64')
      return `<RunCode code="${code}">${fence(tokens, idx, options, env, self)}</RunCode>`
    }
    return fence(tokens, idx, options, env, self)
  }
}

// ::: trainer  -> notes for the trainer. Rendered ONLY when TRAINER=1;
// otherwise nothing is emitted (the content is dropped, so public builds never contain it).
function trainerNotes(md, enabled, notesDir) {
  md.use(container, 'trainer', {
    render(tokens, idx) {
      if (!enabled) return ''
      return tokens[idx].nesting === 1
        ? '<div class="trainer-note"><p class="trainer-note-title">Trainer notes</p>\n'
        : '</div>\n'
    }
  })
  if (enabled) { injectTrainerNotes(md, notesDir); return }
  // Drop the inner tokens of trainer blocks so their text is not rendered either.
  md.core.ruler.push('trainer_strip', state => {
    const out = []
    let depth = 0
    for (const t of state.tokens) {
      if (t.type === 'container_trainer_open') { depth++; continue }
      if (t.type === 'container_trainer_close') { depth--; continue }
      if (depth === 0) out.push(t)
    }
    state.tokens = out
  })
}

// ---- trainer notes re-injection -------------------------------------------
// With TRAINER=1, page lectures/NN-topic.md gets the sections of
// <trainerDir>/notes/NN-topic.md injected inside `.trainer-note` boxes
// (trainerDir: option of defineCourse, default <course root>/trainer).
// Notes file format: blocks introduced by a marker comment on its own line:
//   <!-- after: Exact heading text -->   insert just before the next heading of the
//                                        same or higher level (end of that section)
//   <!-- before: Exact heading text -->  insert just before that heading
// Text before the first marker goes at the end of the page. HTML comments inside
// blocks and a leading "# title" line are dropped. The heading text is the heading's
// markdown source (e.g. "`let` and `const`"). Missing file or heading: no failure
// (unknown heading -> end of page, with a warning).
const MARKER = /^<!--\s*(after|before)\s*:\s*(.*?)\s*-->\s*$/

function notesFileFor(notesDir, relativePath) {
  const m = /^lectures\/([^/]+)\.md$/.exec(relativePath || '')
  return m ? path.join(notesDir, m[1] + '.md') : null
}

export function parseNotes(text) {
  const blocks = []
  let cur = { kind: 'end', heading: '', lines: [] }
  const flush = () => {
    const body = cur.lines.join('\n').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*# [^\n]*\n?/, '').trim()
    if (body) blocks.push({ kind: cur.kind, heading: cur.heading, body })
  }
  for (const line of text.split(/\r?\n/)) {
    const m = MARKER.exec(line)
    if (m) { flush(); cur = { kind: m[1], heading: m[2], lines: [] } } else cur.lines.push(line)
  }
  flush()
  return blocks
}

function injectTrainerNotes(md, notesDir) {
  md.core.ruler.push('trainer_inject', state => {
    const file = notesFileFor(notesDir, state.env && state.env.relativePath)
    let text
    try { text = file && fs.readFileSync(file, 'utf8') } catch { return }
    if (!text) return
    const tokens = state.tokens
    const headings = []
    tokens.forEach((t, i) => {
      if (t.type === 'heading_open') headings.push({ i, level: +t.tag.slice(1), text: tokens[i + 1].content.trim() })
    })
    const inserts = [] // { pos, order, tokens }
    parseNotes(text).forEach((b, order) => {
      let pos = tokens.length
      const h = headings.findIndex(x => x.text === b.heading)
      if (b.kind !== 'end' && h < 0) {
        console.warn(`[course-kit] trainer notes: heading not found in ${state.env.relativePath}: "${b.heading}"`)
      } else if (b.kind === 'before') {
        pos = headings[h].i
      } else if (b.kind === 'after') {
        const next = headings.slice(h + 1).find(x => x.level <= headings[h].level)
        if (next) pos = next.i
      }
      inserts.push({ pos, order, tokens: md.parse(`::: trainer\n${b.body}\n:::\n`, {}) })
    })
    inserts.sort((a, b) => b.pos - a.pos || b.order - a.order)
    for (const ins of inserts) tokens.splice(ins.pos, 0, ...ins.tokens)
  })
}

// dev server: re-render a lecture when its notes file changes
function trainerNotesWatcher(root, notesDir) {
  return {
    name: 'course-kit-trainer-notes',
    enforce: 'pre',
    // VitePress caches rendered pages by source text: tag the source with the notes
    // content so a notes edit invalidates the cached render
    transform(code, id) {
      const file = notesFileFor(notesDir, path.relative(path.join(root, 'site'), id.split('?')[0]))
      let text
      try { text = file && fs.readFileSync(file, 'utf8') } catch { return }
      if (text == null) return
      return { code: code + `\n<!-- trainer-notes:${createHash('md5').update(text).digest('hex')} -->\n`, map: null }
    },
    configureServer(server) {
      let dir = notesDir
      try { dir = fs.realpathSync(dir) } catch { return } // the trainer folder may be a symlink
      server.watcher.add(dir)
      const onChange = f => {
        if (!f.startsWith(dir + path.sep) || !f.endsWith('.md')) return
        const lecture = path.join(root, 'site', 'lectures', path.basename(f))
        if (fs.existsSync(lecture)) {
          const now = new Date()
          fs.utimesSync(lecture, now, now)
          server.watcher.emit('change', lecture)
        }
      }
      server.watcher.on('change', onChange)
      server.watcher.on('add', onChange)
    }
  }
}

function withBase(base, p) {
  return base.replace(/\/$/, '') + p
}

/**
 * defineCourse({ title, description, lang, nav, sidebar, footerMessage, base, data, trainerDir })
 *   data - optional path (relative to the course root) to a JSON file exposed to
 *          runnable code blocks as `doc`. Default: {}.
 *   trainerDir - optional path (relative to the course root) to the trainer folder;
 *          notes are read from <trainerDir>/notes/. Default: 'trainer'.
 *          Example for a trainer folder next to the course repo: '../trainer'.
 * Returns a full VitePress config.
 */
export function defineCourse({
  title,
  description = '',
  lang = 'en',
  nav = [],
  sidebar = [],
  footerMessage = '',
  base,
  data,
  trainerDir = 'trainer'
} = {}) {
  const resolvedBase = base || process.env.BASE || '/'
  const trainer = process.env.TRAINER === '1'
  const dataFile = data ? path.resolve(process.cwd(), data) : path.join(here, 'theme/empty-data.json')
  const notesDir = path.join(path.resolve(process.cwd(), trainerDir), 'notes')

  return defineConfig({
    title,
    description,
    lang,
    base: resolvedBase,
    cleanUrls: true,
    lastUpdated: false,
    head: [['link', { rel: 'icon', href: withBase(resolvedBase, '/favicon.svg') }]],
    markdown: {
      lineNumbers: false,
      config(md) {
        runnableCode(md)
        trainerNotes(md, trainer, notesDir)
      }
    },
    vite: {
      plugins: trainer ? [trainerNotesWatcher(process.cwd(), notesDir)] : [],
      // the Notes button is only shown in TRAINER=1 builds
      define: { __CK_TRAINER__: JSON.stringify(trainer) },
      resolve: {
        alias: { 'course-data': dataFile },
        // the kit may be symlinked (file: dependency): keep a single copy of vue
        dedupe: ['vue']
      },
      // the theme ships .vue/.css sources: let Vite process them during SSR
      ssr: { noExternal: ['@sciscend/course-kit'] },
      server: { fs: { strict: false } }
    },
    themeConfig: {
      nav,
      sidebar,
      outline: { level: [2, 2], label: 'In this page' },
      search: { provider: 'local' },
      docFooter: { prev: 'Previous', next: 'Next' },
      footer: {
        message: [footerMessage, '<a href="https://sciscend.com" target="_blank" rel="noopener">SciScend</a>']
          .filter(Boolean)
          .join(' - ')
      }
    }
  })
}

export default defineCourse
