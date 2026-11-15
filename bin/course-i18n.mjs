#!/usr/bin/env node
// Translation commands of a course site (run from the course root, Slides/):
//   course-i18n update | status | check | todo [page ...] | pack [--all] |
//               import [--translator=NAME] <files or folder> | build   [lang]
// In a course they are the `npm run i18n:*` scripts. See i18n/README.md of the kit.
import { main } from '../i18n/i18n.mjs'

await main(process.argv.slice(2))
