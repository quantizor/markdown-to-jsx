#!/usr/bin/env bun
/**
 * Fail if bun test --coverage reports All-files function or line coverage
 * under the 80% floor. Reads coverage table text from stdin or a file arg.
 *
 * Usage: timeout 5 bun test --coverage 2>&1 | tee /tmp/cov.txt
 *        bun scripts/check-coverage.ts /tmp/cov.txt
 *   or:  bun scripts/check-coverage.ts < /tmp/cov.txt
 */
import fs from 'node:fs'
import process from 'node:process'

const FLOOR = 80

const input =
  process.argv[2] && process.argv[2] !== '-'
    ? fs.readFileSync(process.argv[2], 'utf8')
    : fs.readFileSync(0, 'utf8')

// All files |   92.77 |   94.37 |
const match = input.match(/^\s*All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/m)
if (!match) {
  console.error('check-coverage: could not parse All files coverage row')
  process.exit(1)
}

const funcs = Number(match[1])
const lines = Number(match[2])
console.log(`coverage: funcs ${funcs}%  lines ${lines}%  (floor ${FLOOR}%)`)

if (funcs < FLOOR || lines < FLOOR) {
  console.error(
    `coverage below ${FLOOR}% floor (funcs=${funcs}, lines=${lines})`
  )
  process.exit(1)
}
