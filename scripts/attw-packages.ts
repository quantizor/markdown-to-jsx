#!/usr/bin/env bun

/**
 * Validate the packaging of every published package with are-the-types-wrong:
 * pack each and check that its exports resolve to matching JS and type
 * declarations across the node16 (CJS + ESM) and bundler profiles.
 *
 * node10 is excluded (engines require Node >= 18, and node10 cannot resolve
 * subpath exports at all). false-export-default is ignored: the library sets
 * esModuleInterop off deliberately, so a default export resolves through the
 * CJS-interop shape that attw flags; the default works at runtime (the render
 * smokes prove it) and every default-bearing entry has always shipped this way.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

var ROOT = path.resolve(import.meta.dir, '..')

var PACKAGES = [
  'packages/parser',
  'packages/react',
  'packages/native',
  'packages/solid',
  'packages/vue',
  'packages/html',
  'packages/markdown',
  'packages/compat',
]

var failed: string[] = []
for (var dir of PACKAGES) {
  try {
    execFileSync(
      'bunx',
      [
        'attw',
        '--pack',
        path.join(ROOT, dir),
        '--profile',
        'node16',
        '--ignore-rules',
        'false-export-default',
      ],
      { cwd: ROOT, stdio: 'pipe' }
    )
    console.log(`attw ok: ${dir}`)
  } catch (err) {
    var e = err as { stdout?: Buffer; stderr?: Buffer }
    failed.push(dir)
    console.error(`\nattw FAILED: ${dir}`)
    console.error((e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? ''))
  }
}

if (failed.length > 0) {
  console.error(`\nattw problems in: ${failed.join(', ')}`)
  process.exit(1)
}
console.log('attw: all published packages resolve cleanly.')
