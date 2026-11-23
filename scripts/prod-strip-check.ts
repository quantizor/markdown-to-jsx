#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const distDir = path.join(import.meta.dirname, '..', 'lib', 'dist')

const FORBIDDEN_STRINGS = [
  'Input contains an unsafe JavaScript/VBScript/data expression, it will not be rendered.',
  'Input could not be decoded due to malformed syntax or characters, it will not be rendered.',
  'Style attribute contains an unsafe URL expression, it will not be rendered.',
]

function listDistFiles(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) {
    return out
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listDistFiles(full))
    } else if (/\.(js|cjs)$/.test(entry.name) && !entry.name.endsWith('.map')) {
      out.push(full)
    }
  }
  return out
}

const files = listDistFiles(distDir)
if (files.length === 0) {
  console.error('prod-strip-check: no dist files; run build first')
  process.exit(1)
}

const violations: string[] = []
for (const file of files) {
  const body = fs.readFileSync(file, 'utf8')
  const rel = path.relative(path.join(import.meta.dirname, '..'), file)
  for (const needle of FORBIDDEN_STRINGS) {
    if (body.includes(needle)) {
      violations.push(`${rel}: retains DEV warn string`)
    }
  }
  if (/\bconsole\.warn\s*\(/.test(body)) {
    violations.push(`${rel}: contains console.warn(`)
  }
  if (/\bconsole\.error\s*\(/.test(body)) {
    violations.push(`${rel}: contains console.error(`)
  }
  if (/\.env\.NODE_ENV\b/.test(body)) {
    violations.push(`${rel}: retains .env.NODE_ENV after production define`)
  }
}

if (violations.length > 0) {
  console.error('prod-strip-check failed:')
  for (const v of violations) {
    console.error(`  - ${v}`)
  }
  process.exit(1)
}
console.log(`prod-strip-check ok (${files.length} files)`)
