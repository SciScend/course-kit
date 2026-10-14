# course-kit

Shared, versioned package for every SciScend course site: VitePress config,
theme (runnable code blocks, trainer/present modes), homework `check.js`,
Pages deploy workflow and a course scaffold.

## Architecture

Each course is three separate things:

1. Public site repo (`SciScend/<slug>`): VitePress site, deployed to GitHub Pages. Depends on this kit.
2. Public homework template repo: the `code/` tasks students copy (uses `homework/check.js`).
3. Local-only trainer vault (`/data/projects/teaching/trainer-vault/<slug>/`): notes, solutions, planning. Not a git repo that is ever pushed publicly. Linked into the course as `./trainer` (git-ignored).

Rule: trainer material never goes in a public repo. `::: trainer` blocks in
lectures are dropped from the HTML unless `TRAINER=1`, so public builds stay clean.

## Start a course

    node bin/new-course.mjs <slug> "<Title>" [--out <parent dir>] [--vault <parent dir>]
    cd ../<slug> && npm install && npm run dev

It refuses to overwrite existing folders. Edit `site/.vitepress/config.mjs`.

API:

    defineCourse({ title, description, lang, nav, sidebar, footerMessage, base, data })

`base` falls back to `BASE` env, then `/`. `data` is an optional JSON path
(relative to the course root) exposed as `doc` in ```` ```js run ```` blocks.
Footer always links to https://sciscend.com.

## Depend on the kit

Before the kit is pushed: `"@sciscend/course-kit": "file:../course-kit"` (the
scaffold adds `.npmrc` with `install-links=true`; after kit changes run `rm -rf node_modules/@sciscend scaffold adds `.npmrc` with `install-links=true`; re-run `npm install` after kit changes).scaffold adds `.npmrc` with `install-links=true`; re-run `npm install` after kit changes). npm install`, plain `npm install` does not re-copy).
After: `"@sciscend/course-kit": "github:SciScend/course-kit#v0.1.0"`.

## Upgrade the kit

Tag a release in this repo (`git tag v0.2.0`), then in each course change the
`#vX` in package.json, run `npm install`, `npm run build`, commit.

## Teach with trainer notes

    TRAINER=1 npm run dev

Open the site and press "t" (or use the Notes button) to show the notes.
Never deploy a `TRAINER=1` build. The Notes button is only rendered when `TRAINER=1`.

### Notes files (re-injection)

With `TRAINER=1`, for each page `lectures/NN-topic.md` the kit reads
`trainer/notes/NN-topic.md` (from the course root, i.e. the working directory) if it
exists and injects its blocks into the page inside `.trainer-note` boxes. No file, no
`trainer/` folder, or no `TRAINER`: nothing happens and nothing fails. Blocks are
introduced by a marker comment alone on a line:

    <!-- after: Exact heading text -->    at the end of that section (just before the
                                           next heading of the same or higher level)
    <!-- before: Exact heading text -->   just before that heading

Text before the first marker goes at the end of the page. The heading text is the
heading's markdown source (e.g. `` `let` and `const` ``); an unknown heading gives a
warning and the block goes to the end. HTML comments and a leading `# title` line in
the notes file are ignored. Editing a notes file re-renders its lecture in `dev`.

## Homework check

`homework/check.js` prints OK/FAIL per check, a final "N of M checks passed",
and sets exit code 1 on any failure (usable in CI).

## First publish checklist (per course)

1. Push course-kit to github.com/SciScend/course-kit and tag a version (v0.1.0).
2. In the course, change the dependency from `file:...` to
   `github:SciScend/course-kit#v0.1.0` and run `npm install`.
3. Create the public repos `<course>` and `<course>-homework` (mark the latter as a
   template repository) in the SciScend org.
4. Course repo: Settings -> Pages -> Source: GitHub Actions. Push main.
5. Check that `trainer` is in .gitignore and `git ls-files | grep -i trainer` is empty.

---

Built with Claude Sonnet 5.5 via Claude Code. Published by [SciScend](https://sciscend.com/).
