#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Run executable fences from lib/llms.txt that import markdown-to-jsx string
 * compilers (html/markdown) or a self-contained react compiler/parser call.
 * Skips illustrative fragments that reference undefined locals.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const llmsPath = path.join(import.meta.dirname, '..', 'lib', 'llms.txt')
const text = fs.readFileSync(llmsPath, 'utf8')

const fenceRe = /```(?:ts|tsx|js|javascript)\n([\s\S]*?)```/g
const SKIP_IF = [
  'DatePicker',
  'Title',
  'SyntaxHighlightedCode',
  'SyntaxHighlighter',
  'TeX',
  'createSignal',
  'StyleSheet',
  'Linking',
  'content',
  'CDN',
  'HighlightedCode',
  'window.hljs',
  '<Markdown',
  'setContent',
]

interface Fence {
  index: number
  body: string
}
const fences: Fence[] = []
var m: RegExpExecArray | null
var idx = 0
while ((m = fenceRe.exec(text)) !== null) {
  idx++
  fences.push({ index: idx, body: m[1] })
}

var ran = 0
var failed = 0

for (const fence of fences) {
  if (!/from ['"]markdown-to-jsx\//.test(fence.body)) {
    continue
  }
  if (SKIP_IF.some(s => fence.body.includes(s))) {
    continue
  }
  // Only self-contained compile/parser demos against html, markdown, or react.
  if (!/markdown-to-jsx\/(html|markdown|react)/.test(fence.body)) {
    continue
  }
  // native/solid/vue need more runtime than a one-shot eval
  if (/markdown-to-jsx\/(native|solid|vue)/.test(fence.body)) {
    continue
  }

  const wrapped = fence.body.includes('markdown-to-jsx/react')
    ? `
import * as React from 'react'
${fence.body}
`
    : fence.body

  const result = spawnSync('bun', ['-e', wrapped], {
    // Package exports resolve from lib/ (workspace package name).
    cwd: path.join(import.meta.dirname, '..', 'lib'),
    encoding: 'utf8',
    env: process.env,
  })
  ran++
  if (result.status === 0) {
    console.log(`OK llms fence #${fence.index}`)
  } else {
    failed++
    console.error(`FAIL llms fence #${fence.index}:`)
    console.error(result.stderr || result.stdout)
  }
}

if (ran === 0) {
  console.error('llms-snippets: no executable fences selected')
  process.exit(1)
}
if (failed > 0) {
  process.exit(1)
}
console.log(`llms-snippets ok (${ran} fences)`)
