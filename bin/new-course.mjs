#!/usr/bin/env node
// Scaffold a new course folder with its repositories side by side:
//
//   <Name>/                 plain folder, not a git repo (local README with the table)
//       Slides/             repo <owner>/<Name>-Slides    public  - lectures (VitePress site)
//       Homework/           repo <owner>/<Name>-Homework  public  - tasks; students clone + pull
//       Labs/               repo <owner>/<Name>-Labs      public  - code written in class
//       trainer/            repo <owner>/<Name>-Trainer   PRIVATE - notes, solutions, planning
//       ai/                 local only - session reports
//
//   node bin/new-course.mjs <Name> "<Title>" [--out <parent dir>] [--owner <github owner>]
//                           [--github] [--no-install]
//
// Defaults: --out = current directory, --owner = ivapopova-courses.
// Every repo gets `git init`, its origin remote (SSH) and a first commit.
// --github also creates the four GitHub repos with `gh`, pushes them and turns on
// GitHub Pages (source: GitHub Actions) for Slides.
// --no-install skips `npm install` in Slides (then commit package-lock.json yourself
// before the first push, or the Pages build fails on `npm ci`).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const kitDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const kitVersion = JSON.parse(fs.readFileSync(path.join(kitDir, 'package.json'), 'utf8')).version

const args = process.argv.slice(2)
const opts = { owner: 'ivapopova-courses', out: process.cwd() }
const flags = new Set()
const pos = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' || args[i] === '--owner') opts[args[i].slice(2)] = args[++i]
  else if (args[i] === '--github' || args[i] === '--no-install') flags.add(args[i])
  else pos.push(args[i])
}
const [name, title] = pos
if (!name || !title || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || !opts.owner) {
  console.error('Usage: node bin/new-course.mjs <Name> "<Title>" [--out <dir>] [--owner <owner>] [--github] [--no-install]')
  console.error('Name: letters, digits, dots, dashes and underscores (e.g. JS-Basics-Practical-ACME)')
  process.exit(2)
}

const root = path.join(path.resolve(opts.out), name)
if (fs.existsSync(root)) { console.error('Refusing to overwrite existing folder: ' + root); process.exit(1) }

const owner = opts.owner
const parts = {
  Slides: { visibility: 'public', desc: 'lectures (course site)', what: 'The lectures (VitePress site), published on GitHub Pages' },
  Homework: { visibility: 'public', desc: 'practice tasks and homework', what: 'Practice tasks and homework. Students clone it, work in it and pull the new tasks' },
  Labs: { visibility: 'public', desc: 'code written in class', what: 'The code written in class. Students only pull it' },
  trainer: { repo: 'Trainer', visibility: 'private', desc: 'trainer notes, solutions and planning (private)', what: 'Trainer notes, solutions and planning' }
}
const repoName = part => `${name}-${parts[part].repo || part}`
const webUrl = part => `https://github.com/${owner}/${repoName(part)}`
const sshUrl = part => `git@github.com:${owner}/${repoName(part)}.git`
const pagesUrl = `https://${owner.toLowerCase()}.github.io/${repoName('Slides')}/`
const q = s => JSON.stringify(s)

const files = {} // path relative to root -> content

// ---- course folder (local only) ----------------------------------------------

files['README.md'] = `# ${name} - course folder

${title}. This folder is **not** a git repository: it holds the course repositories
side by side, plus local-only material. This README is local too.

## Folders and repositories

| Folder | GitHub URL | What it is |
|---|---|---|
| \`${name}/\` | none (not a git repo) | The course folder; holds everything below |
| \`Slides/\` | ${webUrl('Slides')} | ${parts.Slides.what}: ${pagesUrl}. Public |
| \`Homework/\` | ${webUrl('Homework')} | ${parts.Homework.what}. Public |
| \`Labs/\` | ${webUrl('Labs')} | ${parts.Labs.what}. Public |
| \`trainer/\` | ${webUrl('trainer')} | ${parts.trainer.what}. **Private** |
| \`ai/\` | none | Reports from the Claude sessions. Local only |

The site engine is https://github.com/SciScend/course-kit (Slides depends on tag
\`v${kitVersion}\`). The git remotes use SSH; the students use the https URLs above.

## For the students

### Homework - clone, work, pull

Once: create an **empty** repository of your own on GitHub (private is fine, no
README), then:

\`\`\`bash
git clone ${webUrl('Homework')}.git
cd ${repoName('Homework')}
git remote rename origin upstream                                      # course repo: new tasks
git remote add origin https://github.com/<your-user>/<your-repo>.git   # your repo: your work
git push -u origin main
\`\`\`

Every time:

\`\`\`bash
node 01-intro/practice/task1.js                                 # run a task (OK / FAIL)
git add . && git commit -m "Session 1 practice" && git push     # save your work
git pull upstream main                                          # before a session: new tasks
\`\`\`

### Labs - pull only

\`\`\`bash
git clone ${webUrl('Labs')}.git
cd ${repoName('Labs')}
git pull            # after each lesson
\`\`\`

## For the trainer

### Before a session

1. **Lecture:** add \`Slides/site/lectures/NN-topic.md\`, add it to the sidebar in
   \`Slides/site/.vitepress/config.mjs\`, link it from \`index.md\` and \`agenda.md\`.
   Push - GitHub Actions publishes the site.
2. **Tasks:** add the folder \`Homework/NN-topic/\` (\`practice/taskN-*.js\`,
   \`homework.js\`) and push.
3. **Solutions and notes:** \`trainer/solutions/NN-topic/\`, \`trainer/notes/NN-topic.md\`;
   commit and push (private repo).
4. Run every solution: \`node trainer/solutions/NN-topic/<file>.js\`.

**Rule for Homework:** only **add** new files and folders. Do not change a task after
it is published - the students have edited it, and their \`git pull upstream main\`
would conflict. If a published task needs a fix, put the fix in a new file.

### In class

\`\`\`bash
cd Slides
npm run dev:trainer      # site with the trainer notes (key "t"); never deploy this build
\`\`\`

Write the class code in \`Labs/NN-topic/\` and push it after the lesson.

### Never public

\`trainer/\` and \`ai/\` stay out of the public repos. \`trainer/\` is its own private
repository; Slides reads its notes through \`trainerDir: '../trainer'\` only in
\`TRAINER=1\` builds.
`

files['ai/.keep'] = ''

// ---- Slides --------------------------------------------------------------------

files['Slides/package.json'] = JSON.stringify({
  name: repoName('Slides').toLowerCase(),
  private: true,
  type: 'module',
  description: title + ' - lectures',
  scripts: {
    dev: 'vitepress dev site',
    'dev:trainer': 'TRAINER=1 vitepress dev site',
    build: 'vitepress build site',
    'build:trainer': 'TRAINER=1 vitepress build site',
    preview: 'vitepress preview site'
  },
  dependencies: { '@sciscend/course-kit': `github:SciScend/course-kit#v${kitVersion}` },
  devDependencies: { vitepress: '^1.6.4' }
}, null, 2) + '\n'

files['Slides/.gitignore'] = 'node_modules/\nsite/.vitepress/cache/\nsite/.vitepress/dist/\n'

files['Slides/site/.vitepress/config.mjs'] = `import { defineCourse } from '@sciscend/course-kit/config'

export default defineCourse({
  title: ${q(title)},
  description: ${q(title)},
  lang: 'en',
  // data: 'data/sample.json',  // optional JSON exposed as \`doc\` in \`\`\`js run blocks
  // private trainer notes: a folder next to this repo, never published
  trainerDir: '../trainer',
  nav: [
    { text: 'Agenda', link: '/agenda' },
    { text: 'Lectures', link: '/lectures/01-intro' }
  ],
  sidebar: [
    { text: 'Course', items: [
      { text: 'Home', link: '/' },
      { text: 'Agenda', link: '/agenda' },
      { text: 'How to use these pages', link: '/how-to' }
    ] },
    { text: 'Lectures', items: [
      { text: '1. Introduction', link: '/lectures/01-intro' }
    ] }
  ],
  footerMessage: ${q(title)}
})
`
files['Slides/site/.vitepress/theme/index.js'] = `import theme from '@sciscend/course-kit/theme'

export default theme
`
files['Slides/site/index.md'] = `---
layout: home
hero:
  name: ${q(title)}
  text: Course materials
  actions:
    - theme: brand
      text: Agenda
      link: /agenda
    - theme: alt
      text: How to use these pages
      link: /how-to
---
`
files['Slides/site/agenda.md'] = `# Agenda

TODO: sessions and topics.
`
files['Slides/site/how-to.md'] = `# How to use these pages

## Run the examples

Most code examples have **Run**, **Edit** and **Reset** buttons under them. The code
runs in your browser.

## Practice in VSCode

The practice tasks and the homework are in the **Homework repository**:
${webUrl('Homework')}

### Set it up once

1. On GitHub, create a new **empty** repository of your own (private is fine) -
   without a README, licence or \`.gitignore\`.
2. In a terminal:

   \`\`\`bash
   git clone ${webUrl('Homework')}.git
   cd ${repoName('Homework')}
   git remote rename origin upstream
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git push -u origin main
   \`\`\`

3. Open the folder in VSCode.

### Work on a task

Run a task from the repository root; it prints \`OK\` or \`FAIL\` for each check:

\`\`\`bash
node 01-intro/practice/task1.js
\`\`\`

Save your work in your own repository:

\`\`\`bash
git add .
git commit -m "Session 1 practice"
git push
\`\`\`

### Get the new tasks

Before each session, commit your work, then:

\`\`\`bash
git pull upstream main
\`\`\`

## Code from the lessons

The code written during the lessons is in the **Labs repository**:
${webUrl('Labs')}

\`\`\`bash
git clone ${webUrl('Labs')}.git
cd ${repoName('Labs')}
git pull          # after each lesson
\`\`\`

Do not write your own code there - use the Homework repository for that.
`
files['Slides/site/lectures/01-intro.md'] = `# 1. Introduction

## First topic

Runnable example:

\`\`\`js run
console.log('Hello, ' + 'world')
\`\`\`

## Practice

In your copy of the [Homework repository](${webUrl('Homework')}):

\`\`\`bash
node 01-intro/practice/task1.js
\`\`\`
`
files['Slides/site/public/favicon.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#2f5bd3"/><text x="32" y="43" font-family="system-ui, sans-serif" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">${name.slice(0, 2).toUpperCase()}</text></svg>\n`
files['Slides/README.md'] = `# ${title} - Slides (course site)

The lectures, built with VitePress and @sciscend/course-kit and published on
GitHub Pages: ${pagesUrl}

\`\`\`bash
npm install          # once
npm run dev          # live preview at http://localhost:5173
npm run dev:trainer  # with the trainer notes from ../trainer (key "t"); never deploy
npm run build        # static site in site/.vitepress/dist
\`\`\`

| Folder | Repository | What it is |
|---|---|---|
| \`Slides/\` | ${webUrl('Slides')} | this repo - the lectures |
| \`Homework/\` | ${webUrl('Homework')} | practice tasks and homework |
| \`Labs/\` | ${webUrl('Labs')} | code written in class |
| \`trainer/\` | private | trainer notes and solutions |

Never put trainer material (notes, solutions) in this repo.
`
const license = `Course materials: CC BY-NC-SA 4.0
https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode

TODO: replace this note with the full license text and copyright holder.
`
files['Slides/LICENSE'] = license

// ---- Homework ------------------------------------------------------------------

files['Homework/package.json'] = '{\n  "type": "commonjs"\n}\n'
files['Homework/.gitignore'] = 'node_modules/\n.DS_Store\n*.log\n.vscode/\n'
files['Homework/LICENSE'] = license
files['Homework/01-intro/practice/task1.js'] = `"use strict";
// Task 1: example task
// Run: node 01-intro/practice/task1.js

const check = require("../../check.js");

// ---- your code ----
const answer = undefined; // make this 42
// ---- end of your code ----

check("answer", answer, 42);
`
files['Homework/01-intro/homework.js'] = `"use strict";
// Homework of lecture 1
// Run: node 01-intro/homework.js

const check = require("../check.js");

// ---- your code ----
const greeting = undefined; // make this "Hello"
// ---- end of your code ----

check("greeting", greeting, "Hello");
`
files['Homework/README.md'] = `# ${title} - Homework

Practice tasks and homework. Every task checks your code and prints \`OK\` or
\`FAIL\` for each check, and a final line such as \`5 of 7 checks passed\`.

The lectures: ${pagesUrl}

You need [Node.js](https://nodejs.org/) (version 18 or newer) and Git.

## Set it up once

You clone this repository and keep it as \`upstream\` - new tasks come from there.
Your own repository is \`origin\` - your solutions go there.

1. On GitHub, create a new **empty** repository of your own (private is fine) -
   without a README, licence or \`.gitignore\`.
2. In a terminal:

   \`\`\`bash
   git clone ${webUrl('Homework')}.git
   cd ${repoName('Homework')}
   git remote rename origin upstream
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git push -u origin main
   \`\`\`

## Run a task

\`\`\`bash
node 01-intro/practice/task1.js
node 01-intro/homework.js
\`\`\`

## Save your work

\`\`\`bash
git add .
git commit -m "Session 1 practice"
git push
\`\`\`

## Get the new tasks

New lecture folders are added before each session. Commit your work first, then:

\`\`\`bash
git pull upstream main
git push
\`\`\`

Existing files are not changed after they are published, so the pull does not
conflict with your work.

## Layout

\`\`\`text
check.js                       prints OK / FAIL and the final summary
NN-topic/practice/taskN-*.js   practice tasks of lecture NN
NN-topic/homework.js           homework of lecture NN
\`\`\`
`

// ---- Labs ----------------------------------------------------------------------

files['Labs/.gitignore'] = 'node_modules/\n.DS_Store\n*.log\n.vscode/\n'
files['Labs/LICENSE'] = license
files['Labs/README.md'] = `# ${title} - Labs

The code written during the lessons, one folder per session (\`01-intro/\`, ...),
with the same names as the lectures and the Homework folders.

- Lectures: ${pagesUrl}
- Homework: ${webUrl('Homework')}

\`\`\`bash
git clone ${webUrl('Labs')}.git
cd ${repoName('Labs')}
git pull          # after each lesson
\`\`\`

This repository is read-only for students: do not write your own code here (a
\`git pull\` could then conflict with your changes). Copy what you need into your
Homework repository instead.
`

// ---- trainer (private) ---------------------------------------------------------

files['trainer/package.json'] = '{\n  "type": "commonjs"\n}\n'
files['trainer/planning.md'] = `# Planning: ${title} (trainer only)\n`
files['trainer/notes/01-intro.md'] = `# Trainer notes - lecture 1

<!-- before: First topic -->

Notes for the trainer, shown on lectures/01-intro.md only with TRAINER=1.
`
files['trainer/solutions/01-intro/task1.js'] = `"use strict";
// SOLUTION - for the trainer
// Run (from the course folder): node trainer/solutions/01-intro/task1.js

const check = require("../../../Homework/check.js");

// ---- your code ----
const answer = 42;
// ---- end of your code ----

check("answer", answer, 42);
`
files['trainer/README.md'] = `# ${name} - trainer material

Private: notes, solutions and planning. This repo is private on GitHub
(${webUrl('trainer')}) and must never be made public or copied into one of the
public course repos.

\`\`\`text
planning.md                  program, sessions, open questions
notes/NN-topic.md            trainer notes for lecture NN (shown with TRAINER=1)
solutions/NN-topic/*.js      solutions of the tasks of lecture NN
\`\`\`

## Notes

\`Slides/site/.vitepress/config.mjs\` sets \`trainerDir: '../trainer'\`; with
\`npm run dev:trainer\` the course-kit injects \`notes/NN-topic.md\` into
\`lectures/NN-topic.md\`. Each block starts with a marker line:

    <!-- after: Exact heading text -->    at the end of that section
    <!-- before: Exact heading text -->   just before that heading

## Solutions

They load \`Homework/check.js\` relative to their own file, so they run from any folder:

\`\`\`bash
node trainer/solutions/01-intro/task1.js
\`\`\`
`

// ---- write ---------------------------------------------------------------------

const mk = p => fs.mkdirSync(p, { recursive: true })
for (const [rel, content] of Object.entries(files)) {
  const f = path.join(root, rel)
  mk(path.dirname(f))
  fs.writeFileSync(f, content)
}
fs.copyFileSync(path.join(kitDir, 'homework/check.js'), path.join(root, 'Homework/check.js'))
mk(path.join(root, 'Slides/.github/workflows'))
fs.copyFileSync(path.join(kitDir, 'templates/deploy-pages.yml'), path.join(root, 'Slides/.github/workflows/deploy.yml'))

const run = (cmd, cmdArgs, cwd) => execFileSync(cmd, cmdArgs, { cwd, stdio: 'inherit' })

if (!flags.has('--no-install')) run('npm', ['install', '--no-audit', '--no-fund'], path.join(root, 'Slides'))

// git: init, remote first (so a remote-based includeIf identity applies), first commit
for (const part of Object.keys(parts)) {
  const dir = path.join(root, part)
  run('git', ['init', '-q', '-b', 'main'], dir)
  run('git', ['remote', 'add', 'origin', sshUrl(part)], dir)
  run('git', ['add', '-A'], dir)
  run('git', ['commit', '-q', '-m', `Start ${repoName(part)}`], dir)
}

if (flags.has('--github')) {
  for (const part of Object.keys(parts)) {
    const dir = path.join(root, part)
    run('gh', ['repo', 'create', `${owner}/${repoName(part)}`, `--${parts[part].visibility}`,
      '--description', `${title} - ${parts[part].desc}`,
      ...(part === 'trainer' ? [] : ['--homepage', pagesUrl])], dir)
    run('git', ['push', '-q', '-u', 'origin', 'main'], dir)
  }
  run('gh', ['api', '-X', 'POST', `repos/${owner}/${repoName('Slides')}/pages`, '-f', 'build_type=workflow', '--silent'], root)
  // re-run the deploy now that Pages is on (the first push may have run before it)
  run('gh', ['workflow', 'run', 'deploy.yml', '-R', `${owner}/${repoName('Slides')}`], root)
}

console.log('\nCreated course folder: ' + root)
for (const part of Object.keys(parts)) {
  console.log(`  ${(part + '/').padEnd(10)} ${webUrl(part)}  (${parts[part].visibility})`)
}
console.log('  ai/        local only')
if (!flags.has('--github')) {
  console.log('\nThe GitHub repos are not created yet. Create them and push, or rerun with --github')
  console.log('in a new folder. For Slides: Settings -> Pages -> Source: GitHub Actions.')
}
console.log('\nNext: cd ' + path.join(root, 'Slides') + ' && npm run dev')
