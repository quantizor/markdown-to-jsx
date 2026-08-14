#!/usr/bin/env bun

/**
 * Post-build safety net: every `types` path declared in a published package's
 * exports (and its top-level `types`) must exist on disk. Guards against silent
 * DTS generation failures in lib and against a scoped package whose slice was
 * packed without its declarations. Runs independently of bunup's plugins.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

var ROOT = resolve(import.meta.dir, '..')

// Each published package: the directory holding its package.json and dist.
var PACKAGE_DIRS = [
  'lib',
  'packages/parser',
  'packages/react',
  'packages/native',
  'packages/solid',
  'packages/vue',
  'packages/html',
  'packages/markdown',
  'packages/compat',
]

var missing: string[] = []

function walk(baseDir: string, obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) {
    return
  }
  for (var [key, val] of Object.entries(obj)) {
    if (key === 'types' && typeof val === 'string') {
      if (!existsSync(resolve(baseDir, val))) {
        missing.push(`${baseDir}: ${val}`)
      }
    } else {
      walk(baseDir, val)
    }
  }
}

for (var dir of PACKAGE_DIRS) {
  var baseDir = resolve(ROOT, dir)
  var pkg = require(resolve(baseDir, 'package.json'))
  if (pkg.exports) {
    walk(baseDir, pkg.exports)
  }
  if (pkg.types && !existsSync(resolve(baseDir, pkg.types))) {
    missing.push(`${baseDir}: ${pkg.types}`)
  }
}

if (missing.length > 0) {
  console.error(
    `Type declarations missing after build:\n  ${missing.join('\n  ')}`
  )
  process.exit(1)
}

console.log('All type declarations verified.')
