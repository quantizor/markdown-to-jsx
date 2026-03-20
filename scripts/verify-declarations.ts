#!/usr/bin/env bun

/**
 * Post-build verification script that ensures all TypeScript declaration
 * files referenced in package.json exports actually exist on disk.
 *
 * Runs independently of bunup's plugin system as a safety net against
 * silent DTS generation failures.
 */

import { existsSync } from 'fs'
import { resolve } from 'path'

var pkgPath = resolve(import.meta.dir, '..', 'lib', 'package.json')
var pkg = require(pkgPath)
var libDir = resolve(import.meta.dir, '..', 'lib')
var missing: string[] = []

function walk(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) return
  for (var [key, val] of Object.entries(obj)) {
    if (key === 'types' && typeof val === 'string') {
      var abs = resolve(libDir, val)
      if (!existsSync(abs)) missing.push(val)
    } else {
      walk(val)
    }
  }
}

if (pkg.exports) walk(pkg.exports)
if (pkg.types && !existsSync(resolve(libDir, pkg.types))) {
  missing.push(pkg.types)
}

if (missing.length > 0) {
  console.error(
    'Type declarations missing after build:\n  ' + missing.join('\n  ')
  )
  process.exit(1)
}

console.log('All type declarations verified.')
