export type Compile = (markdown: string, options?: object) => unknown

export interface Clock {
  gc: () => void
  now: () => number
}

const PAIRED_WARMUP_ROUNDS = 50
const PAIRED_WARMUP_MS = 300
const PAIRED_SAMPLES = 40
const PAIRED_BLOCK_MS = 2.5

const TINY_INPUT = '_Hello_ **world**!'
const TINY_WARMUP_CALLS = 20_000
const TINY_SAMPLES = 31
const TINY_BLOCK_MS = 10

export function quantile(values: number[], q: number): number {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(q * (sorted.length - 1))]
}

export function pairedRatios({
  baseline,
  candidate,
  candidateFirst,
  clock,
  label,
  markdown,
  options,
}: {
  baseline: Compile
  candidate: Compile
  candidateFirst: boolean
  clock: Clock
  label: string
  markdown: string
  options?: object
}): { ratio: number; ratioP25: number; ratioP75: number; reps: number } {
  const imported = candidateFirst
    ? [candidate, baseline]
    : [baseline, candidate]
  const run = (fn: Compile) => {
    const out = fn(markdown, options)
    if (out == null) {
      throw new Error(`metrics: ${label} returned ${out}`)
    }
  }

  const warmupStart = clock.now()
  for (
    var w = 0;
    w < PAIRED_WARMUP_ROUNDS || clock.now() - warmupStart < PAIRED_WARMUP_MS;
    w++
  ) {
    run(imported[w % 2])
    run(imported[1 - (w % 2)])
  }
  var t0 = clock.now()
  for (var c = 0; c < 3; c++) {
    run(baseline)
  }
  const reps = Math.max(
    1,
    Math.ceil(PAIRED_BLOCK_MS / ((clock.now() - t0) / 3))
  )
  const block = (fn: Compile) => {
    const start = clock.now()
    for (var r = 0; r < reps; r++) {
      run(fn)
    }
    return clock.now() - start
  }

  const ratios: number[] = []
  for (var s = 0; s < PAIRED_SAMPLES; s += 2) {
    clock.gc()
    const candidateFirstMs = block(candidate)
    const baselineSecondMs = block(baseline)
    clock.gc()
    const baselineFirstMs = block(baseline)
    const candidateSecondMs = block(candidate)
    ratios.push(
      (candidateFirstMs + candidateSecondMs) /
        (baselineFirstMs + baselineSecondMs)
    )
  }
  return {
    ratio: quantile(ratios, 0.5),
    ratioP25: quantile(ratios, 0.25),
    ratioP75: quantile(ratios, 0.75),
    reps,
  }
}

export function tinyPerCallUs({
  clock,
  compile,
  label,
  options,
}: {
  clock: Clock
  compile: Compile
  label: string
  options?: object
}): { perCallUs: number; reps: number } {
  const call = () => {
    if (compile(TINY_INPUT, options) == null) {
      throw new Error(`metrics: ${label} returned nothing for TINY_INPUT`)
    }
  }
  for (var w = 0; w < TINY_WARMUP_CALLS; w++) {
    call()
  }
  var reps = 1
  while (true) {
    var t0 = clock.now()
    for (var c = 0; c < reps; c++) {
      call()
    }
    if (clock.now() - t0 >= TINY_BLOCK_MS) {
      break
    }
    reps *= 2
  }
  const perCall: number[] = []
  for (var s = 0; s < TINY_SAMPLES; s++) {
    var start = clock.now()
    for (var r = 0; r < reps; r++) {
      call()
    }
    perCall.push(((clock.now() - start) / reps) * 1000)
  }
  return { perCallUs: quantile(perCall, 0.5), reps }
}
