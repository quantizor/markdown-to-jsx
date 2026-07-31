#!/usr/bin/env bun
/**
 * Scan lib/dist for network API needles (mirrors lib/src/utils.spec.ts source scan).
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const NetworkApis = [
  'fetch(',
  'globalThis.fetch',
  'self.fetch',
  'window.fetch',
  'XMLHttpRequest',
  'http.get',
  'http.request',
  'https.get',
  'https.request',
  'navigator.sendBeacon',
  'new WebSocket',
  'new EventSource',
]

// Browser consumers (and the site Vite build) resolve node:process to {}.
// An import turns process into a local binding so define cannot replace
// process.env.NODE_ENV, and runtime then crashes on {}.env.NODE_ENV.
const ForbiddenModules = ['node:process', 'from"process"', "from'process'"]

const distDir = path.join(import.meta.dirname, '..', 'lib', 'dist')

function listDistFiles(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) {
    return out
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listDistFiles(full))
    } else if (/\.(js|cjs)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const files = listDistFiles(distDir)
if (files.length === 0) {
  console.error('hermetic-dist: no dist files; run build first')
  process.exit(1)
}

const violations: string[] = []
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  const rel = path.relative(path.join(import.meta.dirname, '..'), file)
  const lines = content.split('\n')
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (
      line.startsWith('//') ||
      line.startsWith('*') ||
      line.startsWith('/*')
    ) {
      continue
    }
    for (const api of NetworkApis) {
      if (line.includes(api)) {
        violations.push(`${rel}:${i + 1} contains "${api}"`)
      }
    }
  }
  for (const mod of ForbiddenModules) {
    if (content.includes(mod)) {
      violations.push(`${rel}: contains "${mod}"`)
    }
  }
}

if (violations.length > 0) {
  console.error('hermetic-dist failed:')
  for (const v of violations) {
    console.error(`  - ${v}`)
  }
  process.exit(1)
}
console.log(`hermetic-dist ok (${files.length} files)`)
