# course-kit

Shared, versioned package for every course site: VitePress config, theme
(runnable code blocks, trainer/present modes), translations (a second language
from gettext `.po` files), site checks, homework `check.js`, Pages deploy workflow
and a course scaffold (Slides / Homework / Labs / trainer).

What is the same in every course lives here; a course keeps only its own content
and settings.

## Architecture

Each course is one plain folder (not a git repo) with four repositories side by side:

```text
<Name>/                  local README with the table of folders and repos
    Slides/              <owner>/<Name>-Slides    public  - the VitePress site, deployed to GitHub Pages; depends on this kit
    Homework/            <owner>/<Name>-Homework  public  - tasks; students clone it, keep it as `upstream`,
                                                            push their work to their own `origin`, pull new tasks
    Labs/                <owner>/<Name>-Labs      public  - code written in class; students only pull it
    trainer/             <owner>/<Name>-Trainer   PRIVATE - notes, solutions, planning
    ai/                  local only - Claude session reports
```

Slides reads the trainer notes from `../trainer` (`trainerDir` option) only when
`TRAINER=1`. Solutions load `Homework/check.js` relative to their own file.

Rules:

- Trainer material (notes, solutions) never goes in a public repo. `::: trainer`
  blocks in lectures are dropped from the HTML unless `TRAINER=1`, so public builds
  stay clean.
- Homework is add-only: new folders before each session, published tasks are not
  changed (the students' `git pull upstream main` would conflict).

## Start a course

    node bin/new-course.mjs <Name> "<Title>" [--out <parent dir>] [--owner <github owner>] [--i18n] [--github] [--no-install]

- `--out`: where to create `<Name>/` (default: the current directory).
- `--owner`: GitHub user or organisation (default: `ivapopova-courses`).
- Every repo gets `git init`, its `origin` remote (SSH) and a first commit; Slides
  gets `npm install` first (skip with `--no-install`).
- `--i18n`: the site also gets a Bulgarian version, translated through `.po` files
  (see "Translations").
- `--github`: also create the four repos with `gh` (Trainer private), push them and
  turn on GitHub Pages for Slides.

Example:

    cd /data/projects/teaching/courses/ProgressBG
    node /data/projects/teaching/course-kit/bin/new-course.mjs JS-Basics-Practical-ACME "JS & TS Basics" --github

## Update the kit

Tag a release in this repo (bump `version` in package.json, `git tag -a v0.4.0 -m ...`,
push the tag), then in each course's Slides change the `#vX` in package.json, run
`npm install`, `npm run build`, commit.

## Translations

A second language for the site (now: Bulgarian), with an EN / BG button that keeps
the reader's place. The English Markdown is the source; `npm run i18n:update` writes
one gettext `.po` file per page into the course's `i18n/bg/`, and every `dev` and
`build` generates `site/bg/` from the two. A person translates with `i18n:pack` /
`i18n:import`; a language model with `i18n:todo` / `i18n:import` (only the texts
that need work, as plain text).

The generator, the commands, the button, the translator's instructions and the
common glossary are in this kit; the `.po` files, the glossary of the course and
`i18n/config.json` are in the course. Everything: [`i18n/README.md`](i18n/README.md).

## Check a site

    npm run check            (in a course: "check": "course-check")
    npm run check -- 08      (the argument goes to the course's own checks)

`course-check` prints the problems and one line per step, and exits with 1 if a step
failed:

1. **links** - every link to a page and every `#section` link points to something
   that exists (VitePress checks the pages only, never the `#sections`);
2. **notes** - every trainer notes block names a heading of its lecture;
3. **i18n** - `update`, then no translation has changed code, links or markup;
4. **build** - `npm run build` passes (skip with `--no-build`);
5. **course** - the npm script `check:course` of the course, if it has one (for
   example: run every runnable example of the lectures).

## Teach with trainer notes

    TRAINER=1 npm run dev

Open the site and press "t" (or use the Notes button) to show the notes.
Switching Notes or Present ("p") keeps the line under the nav bar in place, though
the page reflows (`theme/keepPlace.js`).
The EN / BG button (`theme/components/LangSwitch.vue`) keeps the place across the
two versions of a page too (`describePlace()` before the switch,
`restoreDescribedPlace()` after it, from `theme/keepPlace.js`): the pages are built
from the same Markdown, so they have the same headings and blocks in the same order.

`theme/scrollHash.js` (`setupScrollHash(useData())` in the `setup()` of the course's
theme) keeps the `#section` on screen in the address bar while the reader scrolls,
so a copied link, a reload and the EN / BG button open the same place.
Never deploy a `TRAINER=1` build. The Notes button is only rendered when `TRAINER=1`.

Back after a `#link` on the same page returns to the link, not to the top of its
section (`theme/backKeepsPlace.js`; VitePress itself keeps the place only for links to
other pages).

### Notes files (re-injection)

With `TRAINER=1`, for each page `lectures/NN-topic.md` the kit reads
`<trainerDir>/notes/NN-topic.md` if it exists and injects its blocks into the page
inside `.trainer-note` boxes. `trainerDir` is an option of `defineCourse`, a path
relative to the course root (the working directory); the default is `trainer`. For a
trainer folder next to the course repo:

    export default defineCourse({ ..., trainerDir: '../trainer' })

No file, no trainer folder, or no `TRAINER`: nothing happens and nothing fails. Blocks
are introduced by a marker comment alone on a line:

    <!-- start: Exact heading text -->    just after that heading (the start of that
                                           section) - the usual place: the trainer
                                           reads the note before teaching the section
    <!-- before: Exact heading text -->   just before that heading (e.g. the start of
                                           the session, before section 1)
    <!-- after: Exact heading text -->    at the end of that section (just before the
                                           next heading of the same or higher level)

A `before` or `after` box sits outside its own section, so its title names the
heading ("Trainer notes - 4. Default values"). In a lecture page, `::: trainer Some
text` gives the title "Trainer notes - Some text" the same way.

Text before the first marker goes at the end of the page. The heading text is the
heading's markdown source (e.g. `` `let` and `const` ``); an unknown heading gives a
warning and the block goes to the end. HTML comments and a leading `# title` line in
the notes file are ignored. Editing a notes file re-renders its lecture in `dev`.

## The "In this page" column on laptops

VitePress shows the column on the right only on windows from 1280px wide (with
the navigation on the left), so a laptop at 100% zoom often gets none. To show it
from a narrower window:

    export default defineCourse({ ..., asideMinWidth: 1152 })

Between that width and 1279px the column is a bit narrower (224px), the current
section is highlighted in it, and its handle can resize or hide it, as on wider
screens. The default, 1280, changes nothing. The kit changes a media query inside
VitePress' `useAside()` for this; if a VitePress update changes that code, the
build warns `asideMinWidth: the 1280px media query is no longer in VitePress' useAside()`.

## Homework check

`homework/check.js` prints OK/FAIL per check, a final "N of M checks passed",
and sets exit code 1 on any failure (usable in CI).

## First publish checklist (per course, without `--github`)

1. Create the repos `<owner>/<Name>-Slides`, `-Homework`, `-Labs` (public) and
   `-Trainer` (**private**), and push each folder (`git push -u origin main`).
2. Slides: Settings -> Pages -> Source: GitHub Actions; re-run the deploy workflow.
3. Check that `git -C Slides ls-files | grep -i trainer` is empty.

---

Built with Claude Sonnet 5.5 via Claude Code. Published by [SciScend](https://sciscend.com/).
