import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright-core'
import type { Compile } from './metrics-sample.ts'
import {
  assertTarget,
  bundlePath,
  ORDERS,
  PAIRED_INPUTS,
  type PairedRow,
  REPO_ROOT,
  TARGETS,
  type TinyRow,
} from './metrics-targets.ts'

const ORIGIN = 'http://localhost'

const ISOLATION_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

const USAGE =
  'Usage: bun scripts/metrics-chrome.ts --target <name> --root <bundle dir> [--streaming] (--against <bundle dir> --order candidate-first|candidate-second --input <name> | --tiny). Bundle dirs come from scripts/metrics-gate.ts --chrome.'

function argValue(flag: string): string | undefined {
  var index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

function fail(message: string): never {
  console.error(`metrics-chrome: ${message}. ${USAGE}`)
  process.exit(1)
}

const targetName = argValue('--target') ?? fail('pass --target <name>')
assertTarget(targetName)
const candidateRoot = argValue('--root') ?? fail('pass --root <bundle dir>')
const againstRoot = argValue('--against')
const tiny = process.argv.includes('--tiny')
const options = process.argv.includes('--streaming')
  ? { optimizeForStreaming: true }
  : undefined

function bundleFile(root: string): string {
  const file = bundlePath(path.resolve(root), targetName)
  if (!fs.existsSync(file)) {
    fail(`${file} does not exist`)
  }
  return fs.readFileSync(file, 'utf8')
}

async function sampleModule(): Promise<string> {
  const result = await Bun.build({
    entrypoints: [path.join(import.meta.dirname, 'metrics-sample.ts')],
    format: 'esm',
    target: 'browser',
  })
  if (!result.success) {
    throw new Error(
      `metrics-chrome: bundling metrics-sample.ts failed:\n${result.logs.join('\n')}`
    )
  }
  return result.outputs[0].text()
}

const files: Record<string, string> = {
  '/': '<!doctype html><title>metrics</title>',
  '/candidate.mjs': bundleFile(candidateRoot),
  '/metrics-sample.mjs': await sampleModule(),
}
if (againstRoot) {
  files['/baseline.mjs'] = bundleFile(againstRoot)
}

function pairedArgs(): Pick<PairedRow, 'input' | 'order'> {
  const order = ORDERS.find(o => o === argValue('--order'))
  const input = argValue('--input')
  if (!(againstRoot && order && input && Object.hasOwn(PAIRED_INPUTS, input))) {
    fail(
      `pass --against <bundle dir> --order <order> --input <name> (inputs: ${Object.keys(PAIRED_INPUTS).join(', ')}), or --tiny`
    )
  }
  return { input, order }
}

const paired = tiny ? null : pairedArgs()

const server = await chromium.launchServer({
  args: ['--js-flags=--expose-gc'],
  channel: 'chrome',
  headless: true,
})
try {
  const browser = await chromium.connect(server.wsEndpoint())
  const page = await browser.newPage()
  await page.route(`${ORIGIN}/**`, route => {
    const name = new URL(route.request().url()).pathname
    const body = files[name]
    if (body === undefined) {
      return route.fulfill({ body: `no file for ${name}`, status: 404 })
    }
    return route.fulfill({
      body,
      contentType: name.endsWith('.mjs') ? 'text/javascript' : 'text/html',
      headers: ISOLATION_HEADERS,
    })
  })
  await page.goto(`${ORIGIN}/`)

  const measured = await page.evaluate(
    async ({ candidateFirst, exportName, label, markdown, options }) => {
      if (!globalThis.crossOriginIsolated) {
        throw new Error(
          'metrics-chrome: the page is not cross-origin isolated, so Chrome coarsens performance.now() to 100 µs; check the COOP and COEP headers'
        )
      }
      const gc = globalThis.gc
      if (!gc) {
        throw new Error(
          'metrics-chrome: gc is missing; launch Chrome with --js-flags=--expose-gc'
        )
      }
      const isCompile = (value: unknown): value is Compile =>
        typeof value === 'function'
      const load = async (url: string): Promise<Compile> => {
        const mod: Record<string, unknown> = await import(url)
        const fn = mod[exportName]
        if (!isCompile(fn)) {
          throw new Error(`metrics-chrome: ${url} has no ${exportName} export`)
        }
        return fn
      }
      const sampleUrl: string = '/metrics-sample.mjs'
      const sample: typeof import('./metrics-sample.ts') = await import(
        sampleUrl
      )
      const clock = { gc, now: () => performance.now() }

      if (candidateFirst === null) {
        return sample.tinyPerCallUs({
          clock,
          compile: await load('/candidate.mjs'),
          label,
          options,
        })
      }
      var candidate: Compile
      var baseline: Compile
      if (candidateFirst) {
        candidate = await load('/candidate.mjs')
        baseline = await load('/baseline.mjs')
      } else {
        baseline = await load('/baseline.mjs')
        candidate = await load('/candidate.mjs')
      }
      return sample.pairedRatios({
        baseline,
        candidate,
        candidateFirst,
        clock,
        label,
        markdown,
        options,
      })
    },
    {
      candidateFirst: paired ? paired.order === ORDERS[0] : null,
      exportName: TARGETS[targetName].exportName,
      label: paired ? `${targetName} on ${paired.input}` : targetName,
      markdown: paired
        ? fs.readFileSync(
            path.join(REPO_ROOT, PAIRED_INPUTS[paired.input]),
            'utf8'
          )
        : '',
      options,
    }
  )

  if (paired) {
    if (!('ratio' in measured)) {
      throw new Error(
        `metrics-chrome: expected ratios, got ${JSON.stringify(measured)}`
      )
    }
    console.log(
      JSON.stringify({
        ...paired,
        ...measured,
        target: targetName,
      } satisfies PairedRow)
    )
  } else {
    if (!('perCallUs' in measured)) {
      throw new Error(
        `metrics-chrome: expected perCallUs, got ${JSON.stringify(measured)}`
      )
    }
    console.log(
      JSON.stringify({ ...measured, target: targetName } satisfies TinyRow)
    )
  }
} finally {
  await server.kill()
}
