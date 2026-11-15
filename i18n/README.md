# Translations (a second language for a course site)

A course site can have a second language (now: Bulgarian) next to the English one.
The **EN / BG** button next to the theme switch opens the same page, at the same
section, in the other language (on a phone: in the menu). English is the source; the
Bulgarian pages are generated from it and from the translations in `i18n/bg/`.

The method is the same for every course, whatever its topic:

| Where | What | Depends on the course? |
|---|---|---|
| this kit (`i18n/`, `bin/course-i18n.mjs`) | the generator and its commands, the EN / BG button, the translator's instructions, the common glossary | no |
| the course (`Slides/i18n/`) | the translations (`bg/*.po`), the glossary of the course (`glossary.md`), a few settings (`config.json`) | yes |

A course holds no translation code: only data and settings. A fix or a new command
goes into the kit, and every course gets it with the next kit version.

```text
site/**/*.md (English)  --npm run i18n:update-->  i18n/bg/**/*.po  (one file per page)
                                                       |  the translator fills in msgstr
site/**/*.md + i18n/bg/*.po  --npm run dev / build-->  site/bg/**/*.md  (generated, git-ignored)
```

- The `.po` files (gettext) are the standard format for translators: Poedit (free)
  and every professional translation tool (memoQ, Trados, Phrase, Crowdin,
  Weblate) open them. Each entry is one piece of text: a heading, a paragraph, a
  list item, a table cell, a box title, a menu item.
- When the English text changes, the translation of the unchanged pieces is kept.
  A changed piece gets its old translation as a suggestion, marked **fuzzy** (needs
  review). New pieces are empty. Text that was removed stays at the end of the file
  (`#~` lines) and is used as a suggestion if similar text comes back.
- Until a piece is translated (or while it is fuzzy), the Bulgarian page shows the
  English text, with a "translation not finished" box under the title.

## Set up in a course

A new course: `new-course ... --i18n` creates all of this. An existing course:

1. `package.json`, scripts:

   ```json
   "check": "course-check",
   "i18n:update": "course-i18n update",
   "i18n:status": "course-i18n status",
   "i18n:check": "course-i18n check",
   "i18n:todo": "course-i18n todo",
   "i18n:pack": "course-i18n pack",
   "i18n:import": "course-i18n import"
   ```

2. `site/.vitepress/config.mjs`: wrap the config of `defineCourse` (the footer text
   is passed again, so that it is translated too):

   ```js
   import { defineCourse } from '@sciscend/course-kit/config'
   import { withLocales } from '@sciscend/course-kit/i18n'

   const footerMessage = 'My course'
   const course = defineCourse({ ..., footerMessage })
   export default await withLocales(course, { footerMessage })
   ```

3. `.gitignore`: `site/bg/` and `i18n/out/`.
4. `i18n/config.json` (every key is optional) and `i18n/glossary.md` (the terms of the
   course; start it empty and add the terms of each lecture when it is written):

   ```json
   {
     "project": "My course",
     "languages": ["bg"],
     "site": "https://<owner>.github.io/<Name>-Slides/",
     "readers": "The readers are ... ; they read English technical documentation every day."
   }
   ```

   `project` is written in the header of the `.po` files; `site` and `readers` go into
   the translator's instructions.
5. `npm run i18n:update` creates `i18n/bg/*.po`. Commit them.

## Workflow

1. Change or add English pages as usual (`site/...`).
2. `npm run i18n:update` - refreshes `i18n/bg/*.po` from the English text.
3. `npm run i18n:status` - what is translated, fuzzy, missing, and how many English
   words are left (translators charge per word).
4. `npm run i18n:pack` - copies the `.po` files that need work, with
   `TRANSLATOR.md` and `glossary.md`, to `i18n/out/bg-<date>/` and zips it. Send the
   zip. (`npm run i18n:pack -- --all` packs every file, for a full review.)
5. The translator sends the `.po` files back. Import them (files or a folder):

   ```bash
   npm run i18n:import -- ~/Downloads/bg-2026-10-16
   ```

   Import takes only the filled-in translations, matches each file by its
   `X-Source-File` header (the file name does not matter), and then runs `update`.
   If the English changed while the files were out, those translations become
   fuzzy suggestions - nothing is lost.
   The pack also holds the instructions for the translator (`TRANSLATOR.md` of the
   kit, filled in from `i18n/config.json`; a course may have its own
   `i18n/TRANSLATOR.md` instead) and the two glossaries (below).
6. `npm run i18n:check` - finds broken translations: changed code in backticks,
   link targets, HTML tags, `{...}` attributes, bold markers, a `|` in a table cell,
   typographic quotes or dashes. Fix them in the `.po` file.
7. `npm run dev` and look at the page under `/bg/`.
8. Commit the English pages **and** `i18n/bg/`. `site/bg/` is never committed: the
   site config generates it on every `npm run dev` and `npm run build` (also on
   GitHub Actions).

`npm run check` (the kit's `course-check`) runs `update` and `check` together with
the other checks of the site: broken links and `#section` links, the trainer notes,
the build, and the course's own checks.

Small fixes you can make yourself: open the `.po` file in Poedit (or any text
editor), change the `msgstr`, and run `npm run i18n:check`. In `npm run dev`, a saved
`.po` file updates the page at once (except `_site.po`: restart the dev server).

## Translating with a language model

`pack` and `.po` files are for a person with a translation tool. A language model
works better from plain text, and should not read (or write back) a whole `.po` file
for a few changed sentences:

1. `npm run i18n:todo` (all pages) or `npm run i18n:todo -- 08` (the pages with `08`
   in their name) runs `update`, then writes only the texts that still need a
   translation to `i18n/out/todo-bg/<page>.todo.txt`:

   ```text
   # source: site/lectures/08-errors-and-files.md
   ...
   === 3f2a9c1d === heading 2
   1. Errors

   === 77aa01bc === paragraph (changed)
   The new English text.
   --- old English:
   The old English text.
   --- old translation:
   Старият превод.
   ```

2. The translations go into a new file next to it, `<page>.bg.txt`: the same first
   line (`# source: ...`), then for every text its `=== id ===` line and the
   translation under it. Nothing else: no English, no `.po` syntax.
3. `npm run i18n:import -- --translator="<who> (machine translation - to review)" i18n/out/todo-bg`
   puts them into the `.po` files (and sets `Last-Translator` in their header). An id
   that does not exist is reported and skipped; a text without an answer stays to
   translate.
4. `npm run i18n:check`, fix what it reports in the `.po` file, look at the page.

`i18n/out/` is git-ignored. The Claude Code skill `lesson-translate` does these steps.

## Glossaries

| File | What |
|---|---|
| `glossary-common.md` of the kit | the words of every course site (session, lecture, homework, Check yourself, the buttons) and the rule for technical terms |
| `i18n/glossary.md` of the course | the terms of that course: what stays in English, how the rest is translated. Where the two differ, the course wins |

The same English word may stay in English in one course and be translated in
another: it depends on what the readers of that course already know. So the terms
of a topic are never in the common glossary.

## What is translated

| Part | Translated? |
|---|---|
| Headings, paragraphs, lists, tables, box titles (`::: tip Title`), HTML text | yes |
| Front matter: `title`, `description`, and the home page hero and features | yes |
| Menus, site title and description | yes, in `i18n/bg/_site.po` |
| Theme labels ("On this page", "Previous", search, default box titles) | in `LANGS` in the kit's `i18n/i18n.mjs` |
| Code blocks (also their comments), text in backticks | no - code stays English |
| `::: trainer` blocks | no |
| The animations | separate Bulgarian copies in `site/public/animations/bg/` |

Details the generator takes care of:

- **Anchors stay English.** Every Bulgarian heading gets the id of the English one
  (`## 10. Loops {#_10-loops}`), so `#section` links, the trainer's links and the
  language button keep the position.
- **Links.** Site links get the `/bg` prefix (`/agenda` -> `/bg/agenda`); links to files
  in `site/public/` (the animations) are adjusted to the deeper folder, and point to
  the Bulgarian copy when one exists (`animations/x.html` -> `animations/bg/x.html`).
- **Untranslated text** shows in English, never as an empty line.

## Not covered (yet)

- Trainer notes (`npm run dev:trainer`) are shown on the English pages only: the
  kit matches the notes by English heading text and by the path `lectures/...`.
- The kit's buttons (Present, Notes, Run, Edit, Reset) stay in English.
- Another language: add it to `LANGS` in the kit's `i18n/i18n.mjs` (the labels of the
  theme, the style rules for the translator) and release the kit; in the course add it
  to `languages` in `i18n/config.json` and `site/<lang>/` to `.gitignore`, then
  `npm run i18n:update <lang>`. The translator's instructions and the common
  glossary are written for Bulgarian.

## Files

In the kit:

| File | What it is |
|---|---|
| `i18n/i18n.mjs` | the generator: segmenting, `.po` read/write, merge, build, check, todo, the locale config (`withLocales`) |
| `bin/course-i18n.mjs` | the commands behind `npm run i18n:*` |
| `i18n/TRANSLATOR.md` | instructions for the translator (goes into every pack, filled in from the course's `config.json`) |
| `i18n/glossary-common.md` | the common glossary |
| `theme/components/LangSwitch.vue`, `LangSwitchScreen.vue` | the EN / BG button (replaces VitePress' language menu), in the bar and in the phone menu |
| `check/check.mjs`, `bin/course-check.mjs` | `npm run check` |

In the course (`Slides/`):

| File | What it is |
|---|---|
| `i18n/bg/**/*.po` | the Bulgarian translations, one file per English page |
| `i18n/bg/_site.po` | menus, site title and description, footer |
| `i18n/glossary.md` | the terms of the course |
| `i18n/config.json` | the course name, its languages, the site address and the readers |
| `site/.vitepress/config.mjs` | `withLocales(...)` adds the Bulgarian locale |
| `site/bg/`, `i18n/out/` | generated, git-ignored |
