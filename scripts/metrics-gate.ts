#!/usr/bin/env bun
/**
 * Paired timing gate over scripts/metrics.ts.
 *
 * Compares this working tree (or the committed `--candidate` ref, extracted
 * the same way) against `git merge-base <ref> HEAD`, extracted to a temporary
 * directory, for every target plus the streaming parser (or only the named
 * targets, with `--streaming` selecting the streaming variant). Each target
 * runs twice, once per import order, and each run times both implementations
 * in one process in alternating blocks on each paired input, so machine speed
 * cancels out of the ratio. The corrected delta per target and input is the
 * mean of the two orders' median ratios, minus 1 (positive means the
 * candidate is slower). Fails if any corrected delta exceeds its limit:
 * CORE_LIMIT_PCT for the parser and string compilers, JSX_LIMIT_PCT for the
 * JSX renderers, whose shared React/Solid/Vue element work adds noise the
 * parser does not have. A row whose quartiles in either order span more than
 * SPREAD_LIMIT_PCT reports NOISY (also a failure): its median cannot resolve
 * a delta the size of the limit. A row whose lower quartile exceeds the limit
 * in both orders is a FAIL whatever its spread.
 *
 * Each target also gets a tiny case: metrics.ts --tiny times an 18-byte input
 * in its own process, TINY_ROUNDS processes per implementation alternating
 * which goes first, and the delta is the ratio of the two implementations'
 * median per-call times, minus 1. In-process pairing overstates a
 * sub-microsecond workload, which is why this case runs cross-process. Fails
 * over TINY_LIMIT_PCT, and reports NOISY when either side's quartiles span
 * more than TINY_SPREAD_LIMIT_PCT of its median, unless the candidate's lower
 * quartile already exceeds the baseline's upper quartile by the limit.
 *
 * Any missing, extra, or non-finite measurement row fails the gate rather
 * than being skipped. Blind spots: it measures only the paired inputs and the
 * one tiny input in metrics.ts, both trees resolve dependencies from this
 * checkout's lib/node_modules, and other processes contending for the CPU
 * widen the spread, so it runs pre-PR rather than in verify. `--against HEAD
 * --candidate HEAD` compares the committed tree with itself: a null run that
 * shows the noise floor on the current machine.
 *
 * Usage: bun scripts/metrics-gate.ts --against origin/main
 *        [--target <name>]... [--streaming] [--candidate <git ref>]
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { extractLib, mergeBase } from './checkout-ref.ts'
import {
  assertTarget,
  ORDERS,
  type Order,
  PAIRED_INPUTS,
  type PairedRow,
  quantile,
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

/** A measurement the gate cannot score; ends the run with this message. */
class GateError extends Error {}

interface Run {
  label: string
  streaming: boolean
  target: string
}

/** Percent thresholds a row is scored against. */
interface Limits {
  limitPct: number
  spreadLimitPct: number
}

/** Median and quartiles of one in-process ratio measurement. */
type PairedRatios = Pick<PairedRow, 'ratio' | 'ratioP25' | 'ratioP75'>

/** Lower quartile, median, and upper quartile of a set of samples. */
interface Quartiles {
  high: number
  low: number
  mid: number
}

export type Verdict = 'FAIL' | 'NOISY' | 'ok'

// Importing this module for its scoring functions must not start the gate.
if (import.meta.main) {
  try {
    pairedGate()
  } catch (error) {
    if (!(error instanceof GateError)) {
      throw error
    }
    console.error(`metrics-gate: ${error.message}`)
    process.exit(1)
  }
}

/** NOISY outranks FAIL: an over-limit row only reports FAIL once it is judgeable. */
function verdictOf(noisy: boolean, over: boolean): Verdict {
  return noisy ? 'NOISY' : over ? 'FAIL' : 'ok'
}

/**
 * Score one paired input from both import orders. The corrected delta is the
 * mean of the two medians, as a ratio. The row is over when that delta
 * exceeds `limitPct`. It is NOISY when either order's quartiles span more than
 * `spreadLimitPct`, unless the lower quartile exceeds `limitPct` in both
 * orders, which makes the regression certain whatever the spread.
 */
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
  // The lower quartile is the favorable bound: when it clears the limit in
  // both orders the regression holds whatever the spread.
  const unambiguous =
    (first.ratioP25 - 1) * 100 > limitPct &&
    (second.ratioP25 - 1) * 100 > limitPct
  const noisy = !unambiguous && spreadPct > spreadLimitPct

  return { corrected, spreadPct, verdict: verdictOf(noisy, over) }
}

/**
 * Score the tiny case from per-call times (microseconds) of the baseline and
 * candidate processes. The delta is the ratio of the two medians. The row is
 * over when it exceeds `limitPct`. It is NOISY when either side's quartiles
 * span more than `spreadLimitPct` of its median, unless the candidate's lower
 * quartile already exceeds the baseline's upper quartile by `limitPct`.
 */
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
  // Favorable bound: candidate's lower quartile against baseline's upper.
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

function runMetrics(args: string[], label: string): string {
  const result = spawnSync(
    'bun',
    ['--expose-gc', path.join(import.meta.dirname, 'metrics.ts'), ...args],
    { cwd: REPO_ROOT, encoding: 'utf8', env: process.env }
  )
  if (result.status !== 0) {
    throw new GateError(
      `metrics.ts failed for ${label} (exit ${result.status}):\n${result.stderr || result.stdout}`
    )
  }
  return result.stdout || ''
}

/**
 * The JSON lines in `stdout` that carry `key`, typed as the row `metrics.ts`
 * prints. The shape is a promise, not a check: callers validate the values.
 */
function jsonLines<Row>(stdout: string, key: string): Row[] {
  return stdout
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.startsWith('{') && s.includes(`"${key}"`))
    .map(s => JSON.parse(s))
}

/** A ratio from metrics.ts that can be scored: finite and positive. */
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
  const run = (target: string, isStreaming: boolean): Run => ({
    label: isStreaming ? `${target}:streaming` : target,
    streaming: isStreaming,
    target,
  })
  if (named.length > 0) {
    return named.map(target => run(target, streaming))
  }
  return Object.keys(TARGETS)
    .map(target => run(target, streaming))
    .concat(streaming ? [] : [run('parser', true)])
}

function pairedGate() {
  const [ref] = argValues('--against')
  if (!ref) {
    throw new GateError('pass --against <git ref>, e.g. --against origin/main')
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
  var failures = 0
  try {
    const baseline = extractLib(base)
    cleanups.push(baseline.cleanup)
    var candidateRoot = REPO_ROOT
    if (candidateRef) {
      const candidate = extractLib(candidateRef)
      cleanups.push(candidate.cleanup)
      candidateRoot = candidate.root
    }
    const targetNames = (jsx: boolean) =>
      Object.keys(TARGETS)
        .filter(name => TARGETS[name].jsx === jsx)
        .join(', ')
    console.log(
      `metrics-gate paired: ${candidateRef ?? 'this tree'} vs ${ref} merge base ${base.slice(0, 7)}; limits +${CORE_LIMIT_PCT}% (${targetNames(false)}), +${JSX_LIMIT_PCT}% (${targetNames(true)}), tiny +${TINY_LIMIT_PCT}%, spread ${SPREAD_LIMIT_PCT}% (tiny ${TINY_SPREAD_LIMIT_PCT}%)`
    )

    for (const run of runs) {
      failures += pairedRows(run, baseline.root, candidateRoot)
      if (!tinyCase(run, baseline.root, candidateRoot)) {
        failures++
      }
    }
  } finally {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }

  if (failures > 0) {
    console.error(
      `metrics-gate paired: ${failures} row(s) failed against ${ref}'s merge base. A FAIL row is slower beyond its limit: profile with \`bun profile --target <name>\` and compare against the merge base before merging. A NOISY row could not be judged: check \`uptime\` and rerun when the load is low.`
    )
    process.exit(1)
  }
}

/**
 * Time every paired input for `run` in both import orders, print a verdict
 * line per input, and return how many inputs failed or were too noisy.
 */
function pairedRows(
  run: Run,
  baselineRoot: string,
  candidateRoot: string
): number {
  const limitPct = TARGETS[run.target].jsx ? JSX_LIMIT_PCT : CORE_LIMIT_PCT

  var failures = 0
  for (const input of Object.keys(PAIRED_INPUTS)) {
    const [first, second] = ORDERS.map(order =>
      pairedRow({ baselineRoot, candidateRoot, input, order, run })
    )
    const { corrected, verdict } = scorePaired(first, second, {
      limitPct,
      spreadLimitPct: SPREAD_LIMIT_PCT,
    })
    if (verdict !== 'ok') {
      failures++
    }
    console.log(
      `${verdict.padEnd(5)} ${run.label} ${input}: ${pct(corrected)} (candidate first ${pct(first.ratio)} [${pct(first.ratioP25)}, ${pct(first.ratioP75)}], candidate second ${pct(second.ratio)} [${pct(second.ratioP25)}, ${pct(second.ratioP75)}]) limit +${limitPct}%`
    )
  }
  return failures
}

/**
 * Run `metrics.ts` on one input in one import order, in its own process, and
 * return its row, failing the gate unless it prints exactly one scoreable row
 * for that input.
 */
function pairedRow({
  baselineRoot,
  candidateRoot,
  input,
  order,
  run,
}: {
  baselineRoot: string
  candidateRoot: string
  input: string
  order: Order
  run: Run
}): PairedRow {
  const args = [
    '--target',
    run.target,
    '--against',
    baselineRoot,
    '--order',
    order,
    '--input',
    input,
    '--root',
    candidateRoot,
  ]
  if (run.streaming) {
    args.push('--streaming')
  }
  const label = `${run.label} ${input} ${order}`
  const rows = jsonLines<PairedRow>(runMetrics(args, label), 'ratio')
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

/**
 * Time the tiny input for `run` in TINY_ROUNDS processes per implementation,
 * alternating which runs first, print the verdict line, and return whether
 * the candidate is within TINY_LIMIT_PCT of the baseline.
 */
function tinyCase(
  run: Run,
  baselineRoot: string,
  candidateRoot: string
): boolean {
  const perCall: Record<string, number[]> = { baseline: [], candidate: [] }
  const roots: Record<string, string> = {
    baseline: baselineRoot,
    candidate: candidateRoot,
  }
  for (var r = 0; r < TINY_ROUNDS; r++) {
    const order =
      r % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline']
    for (const side of order) {
      const args = ['--target', run.target, '--tiny', '--root', roots[side]]
      if (run.streaming) {
        args.push('--streaming')
      }
      const rows = jsonLines<TinyRow>(
        runMetrics(args, `${run.label} tiny ${side}`),
        'perCallUs'
      )
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
  return verdict === 'ok'
}
