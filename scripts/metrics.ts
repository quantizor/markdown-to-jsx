/**
 * Timing worker for scripts/metrics-gate.ts, one entry point per process.
 *
 * Paired mode (`--against <root> --order candidate-first|candidate-second`):
 * import the target from the candidate checkout (`--root`, default this one)
 * and from the checkout at <root> (the baseline) into one process, and time
 * them in alternating blocks on one input from PAIRED_INPUTS (`--input`).
 * Prints one JSON line with the median and quartiles of the candidate/baseline
 * time ratio. The import order is fixed per process, so scripts/metrics-gate.ts
 * runs both orders and averages them (standards/performance.md, benchmark
 * methodology).
 *
 * Tiny mode (`--tiny [--root <root>]`): import the target from one checkout
 * only and time TINY_INPUT, printing one JSON line with the median per-call
 * time. One implementation per process keeps import position out of a
 * sub-microsecond measurement; scripts/metrics-gate.ts alternates processes.
 *
 * Usage: bun --expose-gc scripts/metrics.ts --target <name> [--streaming]
 *        (--against <root> --order <order> --input <name> | --tiny)
 *        [--root <root>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import {
  loadCompiler,
  ORDERS,
  PAIRED_INPUTS,
  type PairedRow,
  quantile,
  REPO_ROOT,
  TARGETS,
  type TinyRow,
} from './metrics-targets.ts'

const [CANDIDATE_FIRST] = ORDERS

/**
 * Paired warmup runs at least this many rounds and at least PAIRED_WARMUP_MS.
 * A round count alone is too short on a small input: it ends while the engine
 * is still optimizing, and whichever implementation is timed first while that
 * is still happening reads slower.
 */
const PAIRED_WARMUP_ROUNDS = 50
const PAIRED_WARMUP_MS = 300
/**
 * Timed samples per input. Consecutive samples alternate which implementation
 * runs first and are scored as a pair, so an even count keeps every pair whole.
 */
const PAIRED_SAMPLES = 40
/** Minimum wall time of one timed block; the repeat count is calibrated to it. */
const PAIRED_BLOCK_MS = 2.5

/**
 * Input for tiny mode: short enough that per-call setup, not per-character
 * work, dominates the time.
 */
const TINY_INPUT = '_Hello_ **world**!'
/** Untimed calls before tiny mode samples, enough to reach the optimizing tiers. */
const TINY_WARMUP_CALLS = 20_000
/** Timed blocks in tiny mode; the median block is reported. */
const TINY_SAMPLES = 31
/** Minimum wall time of one tiny-mode block, so timer resolution stays negligible. */
const TINY_BLOCK_MS = 10

function argValue(flag: string): string | undefined {
  var index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

function requireTarget(): string {
  const name = argValue('--target')
  if (!name) {
    console.error(
      `metrics: pass --target <name>. Valid targets are: ${Object.keys(TARGETS).join(', ')}`
    )
    process.exit(1)
  }
  return name
}

const targetName = requireTarget()
const againstRoot = argValue('--against')
const candidateRoot = path.resolve(argValue('--root') || REPO_ROOT)

function requireGc(): () => void {
  if (!globalThis.gc) {
    throw new Error(
      'Add --expose-gc to your bun command to enable garbage collection'
    )
  }
  return globalThis.gc
}

const collectGarbage = requireGc()

const compilerOpts = process.argv.includes('--streaming')
  ? { optimizeForStreaming: true }
  : undefined

if (process.argv.includes('--tiny')) {
  await runTiny()
} else if (againstRoot) {
  await runPaired(path.resolve(againstRoot))
} else {
  console.error(
    'metrics: pass --against <root> --order <order> or --tiny. To compare this tree against its merge base, run `bun run metrics:paired`.'
  )
  process.exit(1)
}

async function runPaired(baselineRoot: string) {
  const order = ORDERS.find(o => o === argValue('--order'))
  if (!order) {
    console.error(
      `metrics: --against needs --order ${ORDERS.join(' or --order ')}`
    )
    process.exit(1)
  }
  if (!fs.existsSync(path.join(baselineRoot, 'lib/src'))) {
    console.error(`metrics: ${baselineRoot} has no lib/src to compare against`)
    process.exit(1)
  }

  var candidate: (markdown: string, options?: object) => unknown
  var baseline: (markdown: string, options?: object) => unknown
  if (order === CANDIDATE_FIRST) {
    candidate = await loadCompiler(candidateRoot, targetName)
    baseline = await loadCompiler(baselineRoot, targetName)
  } else {
    baseline = await loadCompiler(baselineRoot, targetName)
    candidate = await loadCompiler(candidateRoot, targetName)
  }
  const imported =
    order === CANDIDATE_FIRST ? [candidate, baseline] : [baseline, candidate]

  // One input per process: an input timed after others runs on code the
  // engine specialized for them, and the implementation that tiers up first
  // stays stuck there for the rest of the process (10-15% on stress).
  const input = argValue('--input')
  if (!(input && Object.hasOwn(PAIRED_INPUTS, input))) {
    console.error(
      `metrics: --against needs --input <name>. Valid inputs are: ${Object.keys(PAIRED_INPUTS).join(', ')}`
    )
    process.exit(1)
  }

  const markdown = fs.readFileSync(
    path.join(REPO_ROOT, PAIRED_INPUTS[input]),
    'utf8'
  )
  const run = (fn: typeof candidate) => {
    const out = fn(markdown, compilerOpts)
    if (out == null) {
      throw new Error(`metrics: ${targetName} returned ${out} for ${input}`)
    }
  }

  // The implementation that calls first tiers up first, which leaves a small
  // bias for the rest of the process. Tie the first call to the import
  // order, which the gate swaps, and alternate after it.
  const warmupStart = performance.now()
  for (
    var w = 0;
    w < PAIRED_WARMUP_ROUNDS ||
    performance.now() - warmupStart < PAIRED_WARMUP_MS;
    w++
  ) {
    run(imported[w % 2])
    run(imported[1 - (w % 2)])
  }
  var t0 = performance.now()
  for (var c = 0; c < 3; c++) {
    run(baseline)
  }
  const reps = Math.max(
    1,
    Math.ceil(PAIRED_BLOCK_MS / ((performance.now() - t0) / 3))
  )
  const block = (fn: typeof candidate) => {
    const start = performance.now()
    for (var r = 0; r < reps; r++) {
      run(fn)
    }
    return performance.now() - start
  }

  // The block timed second in a sample runs measurably faster than the one
  // timed first, so a per-sample ratio is bimodal and its median lands on
  // whichever cluster holds the middle rank. Summing each sample with the
  // next (which runs the other implementation first) cancels that position
  // effect before the ratio is taken.
  const ratios: number[] = []
  for (var s = 0; s < PAIRED_SAMPLES; s += 2) {
    collectGarbage()
    const candidateFirst = block(candidate)
    const baselineSecond = block(baseline)
    collectGarbage()
    const baselineFirst = block(baseline)
    const candidateSecond = block(candidate)
    ratios.push(
      (candidateFirst + candidateSecond) / (baselineFirst + baselineSecond)
    )
  }
  const row = {
    input,
    order,
    ratio: quantile(ratios, 0.5),
    ratioP25: quantile(ratios, 0.25),
    ratioP75: quantile(ratios, 0.75),
    reps,
    target: targetName,
  } satisfies PairedRow
  console.log(JSON.stringify(row))
}

async function runTiny() {
  if (!fs.existsSync(path.join(candidateRoot, 'lib/src'))) {
    console.error(`metrics: ${candidateRoot} has no lib/src to measure`)
    process.exit(1)
  }
  const compile = await loadCompiler(candidateRoot, targetName)
  const call = () => {
    if (compile(TINY_INPUT, compilerOpts) == null) {
      throw new Error(`metrics: ${targetName} returned nothing for TINY_INPUT`)
    }
  }
  for (var w = 0; w < TINY_WARMUP_CALLS; w++) {
    call()
  }
  var reps = 1
  while (true) {
    var t0 = performance.now()
    for (var c = 0; c < reps; c++) {
      call()
    }
    if (performance.now() - t0 >= TINY_BLOCK_MS) {
      break
    }
    reps *= 2
  }
  const perCall: number[] = []
  for (var s = 0; s < TINY_SAMPLES; s++) {
    var start = performance.now()
    for (var r = 0; r < reps; r++) {
      call()
    }
    perCall.push(((performance.now() - start) / reps) * 1000)
  }
  const row = {
    perCallUs: quantile(perCall, 0.5),
    reps,
    target: targetName,
  } satisfies TinyRow
  console.log(JSON.stringify(row))
}
