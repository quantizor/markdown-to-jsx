import path from 'node:path'

/**
 * Every measurable entry point: the module (relative to a checkout root) and
 * the export that turns a markdown string into that target's output. The
 * metrics, metrics-gate, and profile scripts all read this one list. `jsx`
 * marks the JSX renderers, whose element work gets the looser gate limit.
 */
export const TARGETS: Record<
  string,
  { exportName: string; file: string; jsx: boolean }
> = {
  html: { exportName: 'compiler', file: 'lib/src/html.ts', jsx: false },
  markdown: { exportName: 'compiler', file: 'lib/src/markdown.ts', jsx: false },
  parser: { exportName: 'parser', file: 'lib/src/parse.ts', jsx: false },
  react: { exportName: 'compiler', file: 'lib/src/react.tsx', jsx: true },
  'react-native': {
    exportName: 'compiler',
    file: 'lib/src/native.tsx',
    jsx: true,
  },
  solid: { exportName: 'compiler', file: 'lib/src/solid.tsx', jsx: true },
  vue: { exportName: 'compiler', file: 'lib/src/vue.tsx', jsx: true },
}

/**
 * Inputs the paired timing comparison measures, as paths relative to this
 * checkout: both implementations time the same bytes, read from here whichever
 * root they are imported from. scripts/metrics.ts prints one row per entry and
 * scripts/metrics-gate.ts requires exactly that many.
 */
export const PAIRED_INPUTS: Record<string, string> = {
  'gfm-spec': 'lib/src/gfm-spec.md',
  'markdown-spec': 'lib/src/markdown-spec.md',
  stress: 'lib/src/stress-test.generated.md',
}

/** The checkout this script lives in. */
export const REPO_ROOT = path.join(import.meta.dirname, '..')

/**
 * The import orders of a paired run. Each process fixes one order, and the
 * gate averages both so import position cancels out.
 */
export const ORDERS = ['candidate-first', 'candidate-second'] as const

export type Order = (typeof ORDERS)[number]

/** One JSON line printed by `metrics.ts --against`: ratios are candidate/baseline time. */
export interface PairedRow {
  input: string
  order: Order
  ratio: number
  ratioP25: number
  ratioP75: number
  reps: number
  target: string
}

/** One JSON line printed by `metrics.ts --tiny`. */
export interface TinyRow {
  perCallUs: number
  reps: number
  target: string
}

/** The value at quantile `q` (0 to 1) of `values`, by lower-index rank. */
export function quantile(values: number[], q: number): number {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(q * (sorted.length - 1))]
}

/** Exit with a usage error unless `target` names an entry in TARGETS. */
export function assertTarget(target: string): void {
  if (!Object.hasOwn(TARGETS, target)) {
    console.error(
      `Invalid target: ${target}. Valid targets are: ${Object.keys(TARGETS).join(', ')}`
    )
    process.exit(1)
  }
}

/**
 * Import one target's compile function from the checkout at `root`. The
 * react-native target first registers this checkout's react-native mock
 * (a process-wide module mock), so the harness cannot drift from the
 * components native.tsx actually imports.
 */
export async function loadCompiler(
  root: string,
  target: string
): Promise<(markdown: string, options?: object) => unknown> {
  assertTarget(target)
  if (target === 'react-native') {
    await import(path.join(REPO_ROOT, 'lib/src/__mocks__/react-native.ts'))
  }
  const entry = TARGETS[target]
  const mod = await import(path.join(root, entry.file))
  const fn = mod[entry.exportName]
  if (typeof fn !== 'function') {
    throw new Error(
      `${path.join(root, entry.file)} has no ${entry.exportName} export; update TARGETS in scripts/metrics-targets.ts`
    )
  }
  return fn
}
