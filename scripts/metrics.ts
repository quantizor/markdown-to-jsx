import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pairedRatios, tinyPerCallUs } from './metrics-sample.ts'
import {
  loadCompiler,
  ORDERS,
  PAIRED_INPUTS,
  type PairedRow,
  REPO_ROOT,
  TARGETS,
  type TinyRow,
} from './metrics-targets.ts'

const [CANDIDATE_FIRST] = ORDERS

function argValue(flag: string): string | undefined {
  var index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

const USAGE =
  'Usage: bun --expose-gc scripts/metrics.ts --target <name> [--streaming] [--bundled] [--root <root>] (--against <root> --order candidate-first|candidate-second --input <name> | --tiny)'

function requireTarget(): string {
  const name = argValue('--target')
  if (!name) {
    console.error(
      `metrics: pass --target <name>. Valid targets are: ${Object.keys(TARGETS).join(', ')}. ${USAGE}`
    )
    process.exit(1)
  }
  return name
}

const targetName = requireTarget()
const againstRoot = argValue('--against')
const candidateRoot = path.resolve(argValue('--root') || REPO_ROOT)
const bundled = process.argv.includes('--bundled')

function requireGc(): () => void {
  if (!globalThis.gc) {
    throw new Error(
      'Add --expose-gc to your bun or node command to enable garbage collection'
    )
  }
  return globalThis.gc
}

const clock = { gc: requireGc(), now: () => performance.now() }

const compilerOpts = process.argv.includes('--streaming')
  ? { optimizeForStreaming: true }
  : undefined

if (process.argv.includes('--tiny')) {
  await runTiny()
} else if (againstRoot) {
  await runPaired(path.resolve(againstRoot))
} else {
  console.error(
    `metrics: pass --against <root> --order <order> --input <name>, or --tiny. ${USAGE}. To compare this tree against its merge base, run \`bun run metrics:paired\`.`
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

  var candidate: (markdown: string, options?: object) => unknown
  var baseline: (markdown: string, options?: object) => unknown
  if (order === CANDIDATE_FIRST) {
    candidate = await loadCompiler(candidateRoot, targetName, bundled)
    baseline = await loadCompiler(baselineRoot, targetName, bundled)
  } else {
    baseline = await loadCompiler(baselineRoot, targetName, bundled)
    candidate = await loadCompiler(candidateRoot, targetName, bundled)
  }

  const input = argValue('--input')
  if (!(input && Object.hasOwn(PAIRED_INPUTS, input))) {
    console.error(
      `metrics: --against needs --input <name>. Valid inputs are: ${Object.keys(PAIRED_INPUTS).join(', ')}`
    )
    process.exit(1)
  }

  const row = {
    input,
    order,
    target: targetName,
    ...pairedRatios({
      baseline,
      candidate,
      candidateFirst: order === CANDIDATE_FIRST,
      clock,
      label: `${targetName} on ${input}`,
      markdown: fs.readFileSync(
        path.join(REPO_ROOT, PAIRED_INPUTS[input]),
        'utf8'
      ),
      options: compilerOpts,
    }),
  } satisfies PairedRow
  console.log(JSON.stringify(row))
}

async function runTiny() {
  const row = {
    target: targetName,
    ...tinyPerCallUs({
      clock,
      compile: await loadCompiler(candidateRoot, targetName, bundled),
      label: targetName,
      options: compilerOpts,
    }),
  } satisfies TinyRow
  console.log(JSON.stringify(row))
}
