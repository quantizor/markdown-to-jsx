#!/usr/bin/env bun
/**
 * Run metrics.ts three times for one target, compare median to baseline.
 * Fail if median exceeds baseline by more than CEILING_PCT.
 *
 * Usage: bun scripts/metrics-gate.ts --target parser
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// The baseline is an absolute wall-clock time, so it only means anything on the
// machine that recorded it: a shared CI runner is about half the speed of a
// development machine and reads every target as a 60-96% regression. The
// ceiling is therefore deliberately loose, sized to catch an extreme regression
// (a quadratic path, a lost fast path) rather than percentage-point drift.
// Small movements are read from `bun metrics` on a stable machine, not here.
const CEILING_PCT = 200
const RUNS = 3

const targetIndex = process.argv.indexOf('--target')
const target = targetIndex === -1 ? 'parser' : process.argv[targetIndex + 1]
const valid = [
  'parser',
  'react',
  'react-native',
  'html',
  'solid',
  'vue',
  'markdown',
]
if (!valid.includes(target)) {
  console.error(`metrics-gate: invalid target ${target}`)
  process.exit(1)
}

const baselinePath = path.join(import.meta.dirname, 'metrics.baseline.json')
const baselines = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Record<
  string,
  { parseTime: number }
>
const baseline = baselines[target]
if (!baseline) {
  console.error(`metrics-gate: no baseline for ${target}`)
  process.exit(1)
}

const times: number[] = []
for (var i = 0; i < RUNS; i++) {
  const result = spawnSync(
    'bun',
    [
      '--expose-gc',
      path.join(import.meta.dirname, 'metrics.ts'),
      '--target',
      target,
      '--json',
    ],
    {
      cwd: path.join(import.meta.dirname, '..'),
      encoding: 'utf8',
      env: process.env,
    }
  )
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    console.error(`metrics-gate: metrics.ts failed for ${target} run ${i + 1}`)
    process.exit(1)
  }
  const line = (result.stdout || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .reverse()
    .find(s => s.startsWith('{') && s.includes('"parseTime"'))
  if (!line) {
    console.error(`metrics-gate: no JSON line from metrics for ${target}`)
    console.error(result.stdout)
    process.exit(1)
  }
  const parsed = JSON.parse(line) as { parseTime: number }
  times.push(parsed.parseTime)
}

times.sort((a, b) => a - b)
const median = times[Math.floor(times.length / 2)]
const changePct = ((median - baseline.parseTime) / baseline.parseTime) * 100
console.log(
  `metrics-gate ${target}: median ${median}ms baseline ${baseline.parseTime}ms (${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%) runs=[${times.join(', ')}]`
)

if (changePct > CEILING_PCT) {
  console.error(
    `metrics-gate ${target}: median exceeds baseline by more than ${CEILING_PCT}%`
  )
  process.exit(1)
}
