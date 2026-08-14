#!/usr/bin/env bun

/**
 * Release guard for the inlined parser. Every renderer bundles the parser
 * source, so a change to a shared parser file changes the bundled parser in
 * all seven published packages. A changeset set that bumps only some of them
 * would republish renderers carrying an older parser than @marqdown/parser.
 *
 * This fires only once changesets exist for the branch (you have started
 * cutting a release): if a shared parser file changed and any changeset is
 * present, every published package must be covered. A branch with no
 * changesets yet is work in progress and passes.
 *
 * Base for the diff is the merge-base with main; if main is unreachable the
 * guard prints a note and passes rather than failing on incomplete git state.
 */

import { execSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

var ROOT = path.resolve(import.meta.dir, '..')

// The seven published packages, each of which inlines the parser.
var PUBLISHED = [
  '@marqdown/parser',
  '@marqdown/react',
  '@marqdown/native',
  '@marqdown/solid',
  '@marqdown/vue',
  '@marqdown/html',
  '@marqdown/markdown',
]

// lib/src files bundled into every renderer. The renderer entries
// (react.tsx, native.tsx, solid.tsx, vue.tsx, html.ts, markdown.ts) and the
// legacy index entries are per-package, not shared, so they are excluded.
var SHARED_PARSER_FILES = [
  'lib/src/parse.ts',
  'lib/src/utils.ts',
  'lib/src/types.ts',
  'lib/src/constants.ts',
  'lib/src/entities.generated.ts',
  'lib/src/entities.browser.ts',
  'lib/src/parser.ts',
]

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf-8' }).trim()
}

function baseRef(): string | null {
  for (var ref of ['origin/main', 'main']) {
    try {
      return git(`merge-base ${ref} HEAD`)
    } catch {}
  }
  return null
}

var base = baseRef()
if (!base) {
  console.log(
    'check-inlined-parser-changesets: main not reachable, skipping (incomplete git state).'
  )
  process.exit(0)
}

// Committed diff vs the merge-base, plus anything staged or unstaged locally.
var changed = new Set<string>()
for (var range of [`diff --name-only ${base} HEAD`, 'diff --name-only HEAD']) {
  for (var line of git(range).split('\n')) {
    if (line) {
      changed.add(line)
    }
  }
}

var parserTouched = SHARED_PARSER_FILES.some(f => changed.has(f))
if (!parserTouched) {
  console.log('check-inlined-parser-changesets: no shared parser change.')
  process.exit(0)
}

// Packages covered by pending changesets (frontmatter keys).
var covered = new Set<string>()
var changesetDir = path.join(ROOT, '.changeset')
var files = readdirSync(changesetDir).filter(
  f => f.endsWith('.md') && f !== 'README.md'
)
for (var file of files) {
  var text = readFileSync(path.join(changesetDir, file), 'utf-8')
  var match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    continue
  }
  for (var fmLine of match[1].split('\n')) {
    var pkg = fmLine.match(/^\s*"([^"]+)"\s*:/)
    if (pkg) {
      covered.add(pkg[1])
    }
  }
}

if (covered.size === 0) {
  console.log(
    'check-inlined-parser-changesets: shared parser changed but no changesets yet (work in progress).'
  )
  process.exit(0)
}

var missing = PUBLISHED.filter(p => !covered.has(p))
if (missing.length > 0) {
  console.error(
    'A shared parser file changed, so the parser is different in every published package.\n' +
      'These packages inline the parser but are missing from the pending changesets:\n  ' +
      missing.join('\n  ') +
      '\n\nAdd them to a changeset (bun changeset) so every renderer republishes with the new parser.'
  )
  process.exit(1)
}

console.log('check-inlined-parser-changesets: all published packages covered.')
