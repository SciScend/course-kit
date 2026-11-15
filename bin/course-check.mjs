#!/usr/bin/env node
// Checks of a course site (run from the course root, Slides/): broken links and
// #sections, trainer notes, translations, the build, the course's own checks.
//   course-check [--no-build] [args for the course's `check:course` script]
// In a course it is `npm run check`. See check/check.mjs.
import { main } from '../check/check.mjs'

await main(process.argv.slice(2))
