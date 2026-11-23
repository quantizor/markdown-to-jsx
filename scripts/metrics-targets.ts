import fs from 'node:fs'
import path from 'node:path'

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

export const PAIRED_INPUTS: Record<string, string> = {
  'gfm-spec': 'lib/src/gfm-spec.md',
  'markdown-spec': 'lib/src/markdown-spec.md',
  stress: 'lib/src/stress-test.generated.md',
}

export const REPO_ROOT = path.join(import.meta.dirname, '..')

export const ORDERS = ['candidate-first', 'candidate-second'] as const

export type Order = (typeof ORDERS)[number]

export interface PairedRow {
  input: string
  order: Order
  ratio: number
  ratioP25: number
  ratioP75: number
  reps: number
  target: string
}

export interface TinyRow {
  perCallUs: number
  reps: number
  target: string
}

export function assertTarget(target: string): void {
  if (!Object.hasOwn(TARGETS, target)) {
    console.error(
      `Invalid target: ${target}. Valid targets are: ${Object.keys(TARGETS).join(', ')}`
    )
    process.exit(1)
  }
}

export function bundlePath(root: string, target: string): string {
  return path.join(root, `${target}.mjs`)
}

export async function loadCompiler(
  root: string,
  target: string,
  bundled = false
): Promise<(markdown: string, options?: object) => unknown> {
  assertTarget(target)
  const entry = TARGETS[target]
  const file = bundled ? bundlePath(root, target) : path.join(root, entry.file)
  if (!fs.existsSync(file)) {
    throw new Error(
      `metrics: ${file} does not exist; pass a --root or --against that holds ${bundled ? `${target}.mjs` : entry.file}`
    )
  }
  if (target === 'react-native') {
    await import(path.join(REPO_ROOT, 'lib/src/__mocks__/react-native.ts'))
  }
  const mod = await import(file)
  const fn = mod[entry.exportName]
  if (typeof fn !== 'function') {
    throw new Error(
      `${file} has no ${entry.exportName} export; update TARGETS in scripts/metrics-targets.ts`
    )
  }
  return fn
}
