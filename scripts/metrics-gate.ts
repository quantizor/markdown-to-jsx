#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { extractLib, mergeBase } from './checkout-ref.ts'
import { quantile } from './metrics-sample.ts'
import {
  assertTarget,
  bundlePath,
  ORDERS,
  type Order,
  PAIRED_INPUTS,
  type PairedRow,
  REPO_ROOT,
  TARGETS,
  type TinyRow,
} from './metrics-targets.ts'

const CORE_LIMIT_PCT = 8
const JSX_LIMIT_PCT = 15
const SPREAD_LIMIT_PCT = 12

const TINY_ROUNDS = 8
const TINY_LIMIT_PCT = 5
const TINY_SPREAD_LIMIT_PCT = 10

const BUNDLED_RUNTIMES = ['chrome', 'node'] as const

const SKIPPED_TARGETS = {
  bun: [],
  chrome: ['react-native'],
  node: ['react-native'],
} satisfies Record<Runtime, string[]>

const PRODUCTION_DEFINE = ['--define', 'process.env.NODE_ENV="production"']

const BUNDLE_FLAGS = {
  chrome: ['--target=browser', '--minify', ...PRODUCTION_DEFINE],
  node: ['--target=node', ...PRODUCTION_DEFINE],
} satisfies Record<BundledRuntime, string[]>

const PRODUCTION_ENV = { ...process.env, NODE_ENV: 'production' }

const SCRIPTS = {
  bun: 'metrics.ts',
  chrome: 'metrics-chrome.ts',
  node: 'metrics.ts',
} satisfies Record<Runtime, string>

class GateError extends Error {}

type BundledRuntime = (typeof BUNDLED_RUNTIMES)[number]

type Runtime = BundledRuntime | 'bun'

interface Run {
  label: string
  runtime: Runtime
  streaming: boolean
  target: string
}

type Roots = Record<Runtime, string>

interface Sides {
  baseline: Roots
  candidate: Roots
}

interface Limits {
  limitPct: number
  spreadLimitPct: number
}

type PairedRatios = Pick<PairedRow, 'ratio' | 'ratioP25' | 'ratioP75'>

interface Quartiles {
  high: number
  low: number
  mid: number
}

export type Verdict = 'FAIL' | 'NOISY' | 'ok'

if (import.meta.main) {
  try {
    await pairedGate()
  } catch (error) {
    if (!(error instanceof GateError)) {
      throw error
    }
    console.error(`metrics-gate: ${error.message}`)
    process.exit(1)
  }
}

function verdictOf(noisy: boolean, over: boolean): Verdict {
  return noisy ? 'NOISY' : over ? 'FAIL' : 'ok'
}

export function scorePaired(
  first: PairedRatios,
  second: PairedRatios,
  { limitPct, spreadLimitPct }: Limits
): { corrected: number; spreadPct: number; verdict: Verdict } {
  const corrected = (first.ratio + second.ratio) / 2
  const spreadPct =
    Math.max(
      first.ratioP75 - first.ratioP25,
      second.ratioP75 - second.ratioP25
    ) * 100
  const over = (corrected - 1) * 100 > limitPct
  const unambiguous =
    (first.ratioP25 - 1) * 100 > limitPct &&
    (second.ratioP25 - 1) * 100 > limitPct
  const noisy = !unambiguous && spreadPct > spreadLimitPct

  return { corrected, spreadPct, verdict: verdictOf(noisy, over) }
}

export function scoreTiny(
  baselineSamples: number[],
  candidateSamples: number[],
  { limitPct, spreadLimitPct }: Limits
): {
  baseline: Quartiles
  candidate: Quartiles
  ratio: number
  verdict: Verdict
} {
  const baseline = quartilesOf(baselineSamples)
  const candidate = quartilesOf(candidateSamples)
  const ratio = candidate.mid / baseline.mid
  const over = (ratio - 1) * 100 > limitPct
  const spreadPct =
    Math.max(
      (baseline.high - baseline.low) / baseline.mid,
      (candidate.high - candidate.low) / candidate.mid
    ) * 100
  const unambiguous = (candidate.low / baseline.high - 1) * 100 > limitPct
  const noisy = !unambiguous && spreadPct > spreadLimitPct

  return { baseline, candidate, ratio, verdict: verdictOf(noisy, over) }
}

function quartilesOf(values: number[]): Quartiles {
  return {
    high: quantile(values, 0.75),
    low: quantile(values, 0.25),
    mid: quantile(values, 0.5),
  }
}

function argValues(flag: string): string[] {
  const values: string[] = []
  for (var a = 0; a < process.argv.length; a++) {
    if (process.argv[a] === flag) {
      const value = process.argv[a + 1]
      if (!value || value.startsWith('--')) {
        throw new GateError(`${flag} needs a value`)
      }
      values.push(value)
    }
  }
  return values
}

var running: ReturnType<typeof Bun.spawn> | undefined

process.on('exit', () => running?.kill('SIGKILL'))

async function runMetrics(
  run: Run,
  args: string[],
  label: string
): Promise<string> {
  const inChrome = run.runtime === 'chrome'
  const script = SCRIPTS[run.runtime]
  const child = Bun.spawn(
    [
      inChrome ? 'bun' : run.runtime,
      ...(inChrome ? [] : ['--expose-gc']),
      path.join(import.meta.dirname, script),
      ...args,
      ...(run.runtime === 'node' ? ['--bundled'] : []),
      ...(run.streaming ? ['--streaming'] : []),
    ],
    { cwd: REPO_ROOT, env: PRODUCTION_ENV, stderr: 'pipe', stdout: 'pipe' }
  )
  running = child
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  running = undefined
  if (status !== 0) {
    const hint =
      inChrome && stderr.includes("Chromium distribution 'chrome' is not")
        ? '\nInstall Google Chrome, or drop --chrome.'
        : ''
    throw new GateError(
      `${script} failed for ${label} (exit ${status}):\n${stderr || stdout}${hint}`
    )
  }
  return stdout
}

function jsonLines<Row>(stdout: string, key: string): Row[] {
  return stdout
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.startsWith('{') && s.includes(`"${key}"`))
    .map(s => JSON.parse(s))
}

function isRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function pct(ratio: number): string {
  const value = (ratio - 1) * 100
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function selectRuns(): Run[] {
  const named = argValues('--target')
  for (const target of named) {
    assertTarget(target)
  }
  const streaming = process.argv.includes('--streaming')
  const runs: Run[] = []
  const add = (runtime: Runtime, target: string, isStreaming: boolean) => {
    const skipped: readonly string[] = SKIPPED_TARGETS[runtime]
    if (skipped.includes(target)) {
      return
    }
    const label = isStreaming ? `${target}:streaming` : target
    runs.push({
      label: runtime === 'bun' ? label : `${runtime} ${label}`,
      runtime,
      streaming: isStreaming,
      target,
    })
  }
  const chosen = BUNDLED_RUNTIMES.filter(runtime =>
    process.argv.includes(`--${runtime}`)
  )
  const runtimes: readonly Runtime[] = chosen.length > 0 ? chosen : ['bun']
  for (const runtime of runtimes) {
    const targets = named.length > 0 ? named : Object.keys(TARGETS)
    for (const target of targets) {
      add(runtime, target, streaming)
    }
    if (named.length === 0 && !streaming) {
      add(runtime, 'parser', true)
    }
  }
  return runs
}

function bundleTargets(
  root: string,
  dir: string,
  runs: Run[],
  runtime: BundledRuntime
): void {
  for (const target of new Set(runs.map(run => run.target))) {
    const entry = path.join(root, TARGETS[target].file)
    const result = spawnSync(
      'bun',
      [
        'build',
        entry,
        ...BUNDLE_FLAGS[runtime],
        '--format=esm',
        `--outfile=${bundlePath(dir, target)}`,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    )
    if (result.status !== 0) {
      throw new GateError(
        `bun build ${entry} for ${runtime} failed (exit ${result.status}):\n${result.stderr || result.stdout}`
      )
    }
  }
}

async function pairedGate() {
  const [ref] = argValues('--against')
  if (!ref) {
    throw new GateError(
      'pass --against <git ref>, e.g. --against origin/main. Usage: bun scripts/metrics-gate.ts --against <git ref> [--target <name>]... [--streaming] [--node] [--chrome] [--candidate <git ref>]'
    )
  }
  const [candidateRef] = argValues('--candidate')
  const runs = selectRuns()

  var base: string
  try {
    base = mergeBase(ref)
  } catch (error) {
    throw new GateError((error as Error).message)
  }

  const cleanups: Array<() => void> = []
  const verdicts: Verdict[] = []
  try {
    const baseline = extractLib(base)
    cleanups.push(baseline.cleanup)
    var candidateRoot = REPO_ROOT
    if (candidateRef) {
      const candidate = extractLib(candidateRef)
      cleanups.push(candidate.cleanup)
      candidateRoot = candidate.root
    }
    const bundled = (root: string, runtime: BundledRuntime) => {
      const own = runs.filter(run => run.runtime === runtime)
      if (own.length === 0) {
        return root
      }
      const dir = fs.mkdtempSync(
        path.join(os.tmpdir(), `markdown-to-jsx-${runtime}-`)
      )
      const remove = () => fs.rmSync(dir, { force: true, recursive: true })
      process.once('exit', remove)
      cleanups.push(remove)
      bundleTargets(root, dir, own, runtime)
      return dir
    }
    const roots = (root: string): Roots => ({
      bun: root,
      chrome: bundled(root, 'chrome'),
      node: bundled(root, 'node'),
    })
    const sides: Sides = {
      baseline: roots(baseline.root),
      candidate: roots(candidateRoot),
    }
    const targetNames = (jsx: boolean) =>
      Object.keys(TARGETS)
        .filter(name => TARGETS[name].jsx === jsx)
        .join(', ')
    console.log(
      `metrics-gate paired: ${candidateRef ?? 'this tree'} vs ${ref} merge base ${base.slice(0, 7)}; limits +${CORE_LIMIT_PCT}% (${targetNames(false)}), +${JSX_LIMIT_PCT}% (${targetNames(true)}), tiny +${TINY_LIMIT_PCT}%, spread ${SPREAD_LIMIT_PCT}% (tiny ${TINY_SPREAD_LIMIT_PCT}%)`
    )

    for (const run of runs) {
      verdicts.push(...(await pairedRows(run, sides)))
      verdicts.push(await tinyCase(run, sides))
    }
  } finally {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }

  const counts = { FAIL: 0, NOISY: 0, ok: 0 } satisfies Record<Verdict, number>
  for (const verdict of verdicts) {
    counts[verdict]++
  }
  if (counts.FAIL + counts.NOISY > 0) {
    console.error(
      `metrics-gate paired: against ${ref}'s merge base, ${counts.FAIL} row(s) FAIL and ${counts.NOISY} row(s) are NOISY. A FAIL row is slower beyond its limit: profile with \`bun profile --target <name>\` and compare against the merge base before merging. A NOISY row could not be judged: check \`uptime\` and rerun when the load is low.`
    )
    process.exit(1)
  }
}

async function pairedRows(run: Run, sides: Sides): Promise<Verdict[]> {
  const limitPct = TARGETS[run.target].jsx ? JSX_LIMIT_PCT : CORE_LIMIT_PCT

  const verdicts: Verdict[] = []
  for (const input of Object.keys(PAIRED_INPUTS)) {
    const first = await pairedRow({ input, order: ORDERS[0], run, sides })
    const second = await pairedRow({ input, order: ORDERS[1], run, sides })
    const { corrected, verdict } = scorePaired(first, second, {
      limitPct,
      spreadLimitPct: SPREAD_LIMIT_PCT,
    })
    verdicts.push(verdict)
    console.log(
      `${verdict.padEnd(5)} ${run.label} ${input}: ${pct(corrected)} (candidate first ${pct(first.ratio)} [${pct(first.ratioP25)}, ${pct(first.ratioP75)}], candidate second ${pct(second.ratio)} [${pct(second.ratioP25)}, ${pct(second.ratioP75)}]) limit +${limitPct}%`
    )
  }
  return verdicts
}

async function pairedRow({
  input,
  order,
  run,
  sides,
}: {
  input: string
  order: Order
  run: Run
  sides: Sides
}): Promise<PairedRow> {
  const args = [
    '--target',
    run.target,
    '--against',
    sides.baseline[run.runtime],
    '--order',
    order,
    '--input',
    input,
    '--root',
    sides.candidate[run.runtime],
  ]
  const label = `${run.label} ${input} ${order}`
  const stdout = await runMetrics(run, args, label)
  const rows = jsonLines<PairedRow>(stdout, 'ratio')
  const [row] = rows
  const scoreable =
    rows.length === 1 &&
    row.input === input &&
    isRatio(row.ratio) &&
    isRatio(row.ratioP25) &&
    isRatio(row.ratioP75)
  if (!scoreable) {
    throw new GateError(
      `${label}: expected one row for ${input} with finite positive ratios, got ${JSON.stringify(rows)}`
    )
  }
  return row
}

async function tinyCase(run: Run, sides: Sides): Promise<Verdict> {
  const perCall: Record<keyof Sides, number[]> = { baseline: [], candidate: [] }
  for (var r = 0; r < TINY_ROUNDS; r++) {
    const order: Array<keyof Sides> =
      r % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline']
    for (const side of order) {
      const args = [
        '--target',
        run.target,
        '--tiny',
        '--root',
        sides[side][run.runtime],
      ]
      const stdout = await runMetrics(run, args, `${run.label} tiny ${side}`)
      const rows = jsonLines<TinyRow>(stdout, 'perCallUs')
      if (rows.length !== 1 || !isRatio(rows[0].perCallUs)) {
        throw new GateError(
          `expected one finite positive perCallUs line from ${run.label} tiny ${side}, got ${JSON.stringify(rows)}`
        )
      }
      perCall[side].push(rows[0].perCallUs)
    }
  }
  const { baseline, candidate, ratio, verdict } = scoreTiny(
    perCall.baseline,
    perCall.candidate,
    { limitPct: TINY_LIMIT_PCT, spreadLimitPct: TINY_SPREAD_LIMIT_PCT }
  )
  console.log(
    `${verdict.padEnd(5)} ${run.label} tiny: ${pct(ratio)} (baseline ${baseline.mid.toFixed(3)}us [${baseline.low.toFixed(3)}, ${baseline.high.toFixed(3)}], candidate ${candidate.mid.toFixed(3)}us [${candidate.low.toFixed(3)}, ${candidate.high.toFixed(3)}], ${TINY_ROUNDS} processes each) limit +${TINY_LIMIT_PCT}%`
  )
  return verdict
}
