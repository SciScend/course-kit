// course-check: what can be checked in a course site without a person reading it.
// Run from the course root (Slides/), in a course: `npm run check`.
//
//   1. links    every link to another page and every #section link (in the page or to
//               another page) points to something that exists. VitePress itself
//               checks only the pages, never the #sections.
//   2. notes    every trainer notes block names a heading that exists in its lecture
//               (only when the trainer folder is there).
//   3. i18n     the .po files match the English pages (`update`), and no translation
//               has changed code, links, tags or attributes (only with i18n/).
//   4. build    `npm run build` passes.
//   5. course   the course's own checks: the npm script `check:course`, if there is
//               one. The arguments of course-check are passed to it.
//
//   course-check [--no-build] [args for check:course]
//
// It prints the problems and one line per step; exit code 1 if any step failed.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const SITE = path.join(ROOT, 'site')
const PUBLIC = path.join(SITE, 'public')
const posix = path.posix
// the environment of the child processes (update, build, the course's checks): as it
// was at the start, before loadSite() turns the trainer notes on in this process
const ENV = { ...process.env }
const I18N_CLI = fileURLToPath(new URL('../bin/course-i18n.mjs', import.meta.url))

const isFile = p => { try { return fs.statSync(p).isFile() } catch { return false } }

async function loadSite() {
  // I18N_CLI: withLocales() returns the config without generating the translated pages.
  // TRAINER: the trainer notes are injected, so their headings and links are checked
  // too, and a course that hides unreleased lectures shows them all.
  process.env.I18N_CLI = '1'
  process.env.TRAINER = '1'
  const file = ['config.mjs', 'config.js'].map(f => path.join(SITE, '.vitepress', f)).find(isFile)
  if (!file) throw new Error('no site/.vitepress/config.mjs here - run course-check from the course root (Slides/)')
  const config = (await import(pathToFileURL(file).href)).default
  const { createMarkdownRenderer } = await import('vitepress')
  const quiet = { info() {}, warn() {}, error: console.error }
  const md = await createMarkdownRenderer(SITE, config.markdown || {}, config.base || '/', quiet)
  return { config, md }
}

function frontMatterEnd(lines) {
  if (lines[0] !== '---') return 0
  const end = lines.indexOf('---', 1)
  return end > 0 ? end + 1 : 0
}

// The ids a #link can point to, and the links, of one page.
function scanPage(md, page, notesWarnings) {
  const lines = fs.readFileSync(path.join(SITE, page), 'utf8').split('\n')
  const fmEnd = frontMatterEnd(lines)
  const body = lines.map((l, i) => (i < fmEnd ? '' : l)).join('\n')
  const warn = console.warn
  console.warn = (...a) => {
    const m = /trainer notes: heading not found in (.*?): "(.*)"$/.exec(a.join(' '))
    if (m) notesWarnings.push({ page: m[1], heading: m[2] }); else warn(...a)
  }
  let tokens
  try { tokens = md.parse(body, { path: path.join(SITE, page), relativePath: page, cleanUrls: true, frontmatter: {} }) } finally { console.warn = warn }

  const ids = new Set()
  const links = []
  const code = new Set()
  const html = (content, line, notes) => {
    for (const m of content.matchAll(/\b(?:id|name)="([^"]+)"/g)) ids.add(m[1])
    for (const m of content.matchAll(/\bhref="([^"]+)"/g)) links.push({ href: m[1], line, notes })
  }
  let line = 0
  let notes = 0 // inside a trainer box: the line numbers there are not those of the page
  let notesBlocks = 0
  for (const t of tokens) {
    if (t.type === 'container_trainer_open') { notes++; notesBlocks++ }
    else if (t.type === 'container_trainer_close') notes--
    if (t.map && !notes) line = t.map[0] + 1
    const id = t.attrGet && t.attrGet('id')
    if (id) ids.add(id)
    if (t.type === 'fence' || t.type === 'code_block') { if (t.map && !notes) for (let i = t.map[0]; i < t.map[1]; i++) code.add(i) }
    if (t.type === 'html_block') html(t.content, line, notes > 0)
    for (const c of t.children || []) {
      const cid = c.attrGet && c.attrGet('id')
      if (cid) ids.add(cid)
      if (c.type === 'link_open') links.push({ href: c.attrGet('href') || '', line, notes: notes > 0 })
      else if (c.type === 'html_inline') html(c.content, line, notes > 0)
    }
  }
  // `{#id}` written on a box (`::: info Title {#id}`) or anywhere else outside code
  lines.forEach((l, i) => { if (!code.has(i)) for (const m of l.matchAll(/\{#([^\s}]+)/g)) ids.add(m[1]) })
  return { ids, links, notesBlocks }
}

function targetPage(page, p, pages) {
  if (!p) return page
  let abs = p.startsWith('/') ? p.slice(1) : posix.normalize(posix.join(posix.dirname(page), p))
  try { abs = decodeURI(abs) } catch { /* keep */ }
  if (abs.startsWith('..')) return undefined // outside the site
  if (isFile(path.join(PUBLIC, abs))) return null // a file in public/: no sections to check
  const clean = abs.replace(/\/$/, '')
  const candidates = [abs, abs.replace(/\.html$/, '.md'), clean + '.md', posix.join(clean, 'index.md'), abs === '' ? 'index.md' : null]
  return candidates.find(c => c && pages.has(c))
}

async function checkLinks() {
  const { englishPages } = await import('../i18n/i18n.mjs')
  const { md } = await loadSite()
  const pages = new Map()
  const notesWarnings = []
  for (const page of englishPages()) pages.set(page, scanPage(md, page, notesWarnings))
  const problems = []
  let count = 0
  for (const [page, { links }] of pages) {
    for (const { href, line, notes } of links) {
      if (!href || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue
      count++
      const at = href.indexOf('#')
      const p = (at < 0 ? href : href.slice(0, at)).split('?')[0]
      let hash = at < 0 ? '' : href.slice(at + 1)
      try { hash = decodeURIComponent(hash) } catch { /* keep */ }
      const where = `site/${page}${notes ? ' (its trainer notes)' : ':' + line}`
      const target = targetPage(page, p, pages)
      if (target === null) continue
      if (target === undefined) { problems.push(`${where}: no such page: ${href}`); continue }
      if (hash && !pages.get(target).ids.has(hash)) problems.push(`${where}: no section #${hash} in site/${target}  (link: ${href})`)
    }
  }
  const notesBlocks = [...pages.values()].reduce((n, p) => n + p.notesBlocks, 0)
  return { problems, count, pages: pages.size, notesWarnings, notesBlocks }
}

function npmScript(name, args = []) {
  return spawnSync('npm', ['run', '-s', name, ...(args.length ? ['--', ...args] : [])], { cwd: ROOT, env: ENV, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

export async function main(argv) {
  const flags = new Set(argv.filter(a => a === '--no-build'))
  const args = argv.filter(a => !flags.has(a))
  const failed = []
  const step = (name, ok, text) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}: ${text}`); if (!ok) failed.push(name) }

  // 1. links, 2. notes
  const { problems, count, pages, notesWarnings, notesBlocks } = await checkLinks()
  problems.forEach(p => console.log(p))
  step('links', !problems.length, problems.length ? `${problems.length} broken link(s)` : `${count} links in ${pages} pages`)
  if (notesBlocks) {
    notesWarnings.forEach(w => console.log(`trainer notes of site/${w.page}: no heading "${w.heading}"`))
    step('notes', !notesWarnings.length, notesWarnings.length ? `${notesWarnings.length} block(s) with an unknown heading` : `${notesBlocks} blocks, each at its heading`)
  }

  // 3. translations - in their own process: `update` must read the pages without the
  // trainer notes, and VitePress keeps one markdown renderer per process
  const i18n = path.join(ROOT, 'i18n')
  const langs = fs.existsSync(i18n) ? fs.readdirSync(i18n).filter(d => isFile(path.join(i18n, d, '_site.po'))) : []
  for (const lang of langs) {
    const run = cmd => spawnSync(process.execPath, [I18N_CLI, cmd, lang], { cwd: ROOT, env: ENV, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const up = run('update')
    const updated = (up.stdout + up.stderr).trim()
    if (updated) console.log(updated)
    const ch = run('check')
    if (ch.status !== 0) console.log((ch.stdout + ch.stderr).trim())
    const all = /^all\s+(\d+)\/(\d+)\s+(\d+)\s+(\d+)/m.exec(run('status').stdout) || []
    const ok = up.status === 0 && ch.status === 0
    step(`i18n ${lang}`, ok, (ok ? '' : 'broken translations (above); ') +
      `${all[1]}/${all[2]} texts translated` + (+all[4] ? `, ${all[4]} to translate (npm run i18n:status)` : ''))
  }

  // 4. build
  const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {}
  if (!flags.has('--no-build') && scripts.build) {
    const r = npmScript('build')
    if (r.status !== 0) console.log((r.stdout + r.stderr).trim().split('\n').slice(-40).join('\n'))
    step('build', r.status === 0, r.status === 0 ? 'npm run build passed' : 'npm run build failed (the end of its output is above)')
  }

  // 5. the course's own checks
  if (scripts['check:course']) {
    const r = npmScript('check:course', args)
    const out = (r.stdout + r.stderr).trim()
    if (out) console.log(out)
    step('course', r.status === 0, `npm run check:course${args.length ? ' -- ' + args.join(' ') : ''}`)
  }

  console.log(failed.length ? `\n${failed.length} step(s) failed: ${failed.join(', ')}` : '\nall checks passed')
  process.exitCode = failed.length ? 1 : 0
}
