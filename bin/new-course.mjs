#!/usr/bin/env node
// Scaffold a new course next to the kit.
//   node bin/new-course.mjs <slug> "<Title>" [--out <parent dir>] [--vault <parent dir>]
// Defaults: course at <kit parent>/<slug>, vault at <kit parent>/trainer-vault/<slug>.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const kitDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opts = {}
const pos = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' || args[i] === '--vault') opts[args[i].slice(2)] = args[++i]
  else pos.push(args[i])
}
const [slug, title] = pos
if (!slug || !title || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error('Usage: node bin/new-course.mjs <slug> "<Title>" [--out <dir>] [--vault <dir>]')
  console.error('slug: lowercase letters, digits and dashes')
  process.exit(2)
}

const outParent = path.resolve(opts.out || path.dirname(kitDir))
const vaultParent = path.resolve(opts.vault || path.join(path.dirname(kitDir), 'trainer-vault'))
const course = path.join(outParent, slug)
const vault = path.join(vaultParent, slug)
for (const p of [course, vault]) {
  if (fs.existsSync(p)) { console.error('Refusing to overwrite existing folder: ' + p); process.exit(1) }
}

const files = {}
const q = s => JSON.stringify(s)
const kitRel = path.relative(course, kitDir) || '.'

files['package.json'] = JSON.stringify({
  name: slug,
  private: true,
  type: 'module',
  description: title,
  scripts: {
    dev: 'vitepress dev site',
    build: 'vitepress build site',
    preview: 'vitepress preview site'
  },
  // Before the kit is pushed: a file: path. After: "github:SciScend/course-kit#vX.Y.Z"
  dependencies: { '@sciscend/course-kit': 'file:' + kitRel.split(path.sep).join('/') },
  devDependencies: { vitepress: '^1.6.4' }
}, null, 2) + '\n'

// install-links: copy the kit instead of symlinking, so its own dependencies resolve
files['.npmrc'] = 'install-links=true\n'

files['.gitignore'] = 'node_modules/\nsite/.vitepress/cache/\nsite/.vitepress/dist/\ntrainer/\n'

files['site/.vitepress/config.mjs'] = `import { defineCourse } from '@sciscend/course-kit/config'

export default defineCourse({
  title: ${q(title)},
  description: ${q(title)},
  lang: 'en',
  nav: [
    { text: 'Agenda', link: '/agenda' },
    { text: 'Lectures', link: '/lectures/01-intro' }
  ],
  sidebar: [
    { text: 'Course', items: [
      { text: 'Home', link: '/' },
      { text: 'Agenda', link: '/agenda' }
    ] },
    { text: 'Lectures', items: [
      { text: '1. Introduction', link: '/lectures/01-intro' }
    ] }
  ],
  footerMessage: ${q(title)}
  // data: 'data/sample.json',  // optional JSON exposed as \`doc\` in \`\`\`js run blocks
})
`
files['site/.vitepress/theme/index.js'] = `import theme from '@sciscend/course-kit/theme'

export default theme
`
files['site/index.md'] = `---
layout: home
hero:
  name: ${title}
  text: Course materials
  actions:
    - theme: brand
      text: Agenda
      link: /agenda
---
`
files['site/agenda.md'] = `# Agenda

TODO: sessions, dates, topics.
`
files['site/lectures/01-intro.md'] = `# 1. Introduction

## First topic

Runnable example:

\`\`\`js run
console.log('Hello, ' + 'world')
\`\`\`

::: trainer
Notes for the trainer. Only built when TRAINER=1.
:::
`
files['site/public/favicon.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#2f5bd3"/><text x="32" y="43" font-family="system-ui, sans-serif" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">${slug.slice(0, 2).toUpperCase()}</text></svg>\n`
files['README.md'] = `# ${title}

Public course site (VitePress, GitHub Pages) built with @sciscend/course-kit.

- Develop: \`npm install && npm run dev\`
- Teach with trainer notes: \`TRAINER=1 npm run dev\`, then press "t"
- Homework: \`node code/01-intro/homework.js\`

\`./trainer\` is a symlink to a local vault and is git-ignored. Never put trainer
material (notes, solutions) in this repo.
`
files['LICENSE'] = `Course materials: CC BY-NC-SA 4.0
https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode

TODO: replace this note with the full license text and copyright holder.
`
files['code/package.json'] = '{\n  "type": "commonjs"\n}\n'
files['code/01-intro/homework.js'] = `"use strict";
// Example task. Run: node code/01-intro/homework.js
const check = require("../check.js");

// ---- your code ----
const answer = undefined; // make this 42
// ---- end of your code ----

check("answer", answer, 42);
`
files['trainer-vault/planning.md'] = `# Planning: ${title}\n`

const mk = p => fs.mkdirSync(p, { recursive: true })
for (const [rel, content] of Object.entries(files)) {
  if (rel.startsWith('trainer-vault/')) continue
  const f = path.join(course, rel)
  mk(path.dirname(f))
  fs.writeFileSync(f, content)
}
fs.copyFileSync(path.join(kitDir, 'homework/check.js'), path.join(course, 'code/check.js'))
mk(path.join(course, '.github/workflows'))
fs.copyFileSync(path.join(kitDir, 'templates/deploy-pages.yml'), path.join(course, '.github/workflows/deploy.yml'))

mk(path.join(vault, 'notes'))
mk(path.join(vault, 'solutions'))
fs.writeFileSync(path.join(vault, 'planning.md'), files['trainer-vault/planning.md'])
fs.symlinkSync(vault, path.join(course, 'trainer'), 'dir')

console.log('Created course: ' + course)
console.log('Created vault:  ' + vault + '  (not a git repo; linked as ./trainer)')
console.log('Next: cd ' + course + ' && npm install && npm run dev')
