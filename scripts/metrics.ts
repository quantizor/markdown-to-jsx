import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { initializeParseMetrics, parser } from '../src/parse.ts'

const WARMUP_ROUNDS = 50
const SIGNIFICANCE_THRESHOLD = 2

const markdown = fs.readFileSync('./src/stress-test.generated.md', 'utf8')
const shouldUpdateBaseline = process.argv.includes('-u')

const targetIndex = process.argv.indexOf('--target')
const targetArg = targetIndex !== -1 ? process.argv[targetIndex + 1] : 'parser'
const validTargets = ['parser', 'react', 'react-native', 'html', 'solid']
if (!validTargets.includes(targetArg)) {
  console.error(
    `Invalid target: ${targetArg}. Valid targets are: ${validTargets.join(', ')}`
  )
  process.exit(1)
}

let compiler: (markdown: string, options?: any) => any
let targetName: string

if (targetArg === 'parser') {
  compiler = parser
  targetName = 'parser'
} else if (targetArg === 'react') {
  const reactModule = await import('../src/react.tsx')
  compiler = reactModule.compiler
  targetName = 'react'
} else if (targetArg === 'react-native') {
  const { mock } = await import('bun:test')
  const React = (await import('react')) as typeof import('react')

  const mockLinkingOpenURL = mock(() => Promise.resolve())

  mock.module('react-native', () => {
    const Text = React.forwardRef((props: any, ref: any) => {
      return React.createElement('Text', { ...props, ref })
    }) as any

    const View = React.forwardRef((props: any, ref: any) => {
      return React.createElement('View', { ...props, ref })
    }) as any

    const Image = React.forwardRef((props: any, ref: any) => {
      return React.createElement('Image', { ...props, ref })
    }) as any

    return {
      Text,
      View,
      Image,
      Linking: {
        openURL: mockLinkingOpenURL,
        canOpenURL: async () => Promise.resolve(true),
      },
      StyleSheet: {
        create: (styles: any) => styles,
      },
    }
  })

  const nativeModule = await import('../src/native.tsx')
  compiler = nativeModule.compiler
  targetName = 'react-native'
} else if (targetArg === 'html') {
  const htmlModule = await import('../src/html.ts')
  compiler = htmlModule.compiler
  targetName = 'html'
} else if (targetArg === 'solid') {
  const solidModule = await import('../src/solid.tsx')
  compiler = solidModule.compiler
  targetName = 'solid'
} else {
  throw new Error(`Invalid target: ${targetArg}`)
}

if (!global.gc) {
  throw new Error(
    'Add --expose-gc to your bun command to enable garbage collection'
  )
}

process.stdout.write(`Running warmup rounds (target: ${targetName})`)
for (let i = 0; i < WARMUP_ROUNDS; i++) {
  compiler(markdown)
  if (i % 5 === 4) process.stdout.write('.')
}

global.gc()
global.gc()
process.stdout.write(' Done.\n\n')

initializeParseMetrics()

const t0 = performance.now()
compiler(markdown)
const t1 = performance.now()

const m = global.parseMetrics
if (!m) {
  throw new Error('parseMetrics not initialized')
}

const isParserTarget = targetArg === 'parser'
const metricsTitle = isParserTarget
  ? 'MARKDOWN PARSING METRICS'
  : 'MARKDOWN COMPILER METRICS'
const timeLabel = isParserTarget ? 'Parse time' : 'Total time'

const blockOrder = [
  'blockQuote',
  'breakThematic',
  'codeBlock',
  'codeFenced',
  'footnote',
  'frontmatter',
  'heading',
  'headingSetext',
  'htmlBlock',
  'htmlComment',
  'listGfmTask',
  'list',
  'paragraph',
  'table',
]

const inlineOrder = [
  'breakLine',
  'codeInline',
  'escaped',
  'formatting',
  'footnoteRef',
  'htmlComment',
  'htmlElement',
  'image',
  'link',
  'linkAngleBrace',
  'linkBareUrl',
  'linkEmail',
  'linkRef',
  'refImage',
]

const EMPTY_PARSER: { attempts: number; hits: number; hitTimings: number[] } = {
  attempts: 0,
  hits: 0,
  hitTimings: [],
}

function calculateMedian(timings: number[]): number {
  if (timings.length === 0) return 0
  const sorted = timings.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function formatParser(name: string, data: typeof EMPTY_PARSER): string {
  const attempts = data.attempts || 0
  const hits = data.hits || 0
  const hitPct = attempts > 0 ? ((hits / attempts) * 100).toFixed(2) : '0.00'
  const missPct =
    attempts > 0 ? (((attempts - hits) / attempts) * 100).toFixed(2) : '0.00'

  const hitTimings = data.hitTimings || []
  const medianHitTime = hitTimings.length > 0 ? calculateMedian(hitTimings) : 0

  let result = `  ${name.padEnd(20)}Attempts:${String(attempts).padStart(7)} Hits:${String(hits).padStart(7)} (${hitPct}% hit, ${missPct}% miss)`

  if (medianHitTime > 0) {
    result += ` [median: ${(medianHitTime * 1000).toFixed(2)}μs]`
  }

  return result
}

function collectParserData(
  order: string[],
  parsers: Record<string, typeof EMPTY_PARSER>
): Record<string, { attempts: number; hits: number }> {
  const result: Record<string, { attempts: number; hits: number }> = {}
  for (const name of order) {
    const data = parsers[name] || EMPTY_PARSER
    result[name] = { attempts: data.attempts, hits: data.hits }
  }
  return result
}

console.log('============================================================')
console.log(metricsTitle)
console.log(`Target: ${targetName}`)
console.log('============================================================')
console.log('')

console.log('Block Parser Performance:')
console.log('------------------------------------------------------------')
for (const name of blockOrder) {
  console.log(formatParser(name, m.blockParsers[name] || EMPTY_PARSER))
}

console.log('')
console.log('Inline Parser Performance:')
console.log('------------------------------------------------------------')
for (const name of inlineOrder) {
  console.log(formatParser(name, m.inlineParsers[name] || EMPTY_PARSER))
}

console.log('')
console.log('Operation Counts:')
console.log('------------------------------------------------------------')
console.log(`  Total Operations:      ${String(m.totalOperations).padStart(6)}`)
console.log(
  `  Block Parse Iterations: ${String(m.blockParseIterations).padStart(6)}`
)
console.log(
  `  Inline Parse Iterations: ${String(m.inlineParseIterations).padStart(6)}`
)
console.log('============================================================')
console.log('==================================================')
console.log(`Input size: ${Math.round(markdown.length / 1024)}KB`)
console.log(`${timeLabel}: ${(t1 - t0).toFixed(2)}ms`)
console.log('==================================================')

const metricsData = {
  timestamp: new Date().toISOString(),
  target: targetName,
  inputSize: Math.round(markdown.length / 1024),
  parseTime: +(t1 - t0).toFixed(2),
  blockParsers: collectParserData(blockOrder, m.blockParsers),
  inlineParsers: collectParserData(inlineOrder, m.inlineParsers),
  operationCounts: {
    totalOperations: m.totalOperations,
    blockParseIterations: m.blockParseIterations,
    inlineParseIterations: m.inlineParseIterations,
  },
}

const baselinePath = path.join(import.meta.dirname, 'metrics.baseline.json')

let allBaselines: Record<string, any> = {}
if (fs.existsSync(baselinePath)) {
  try {
    allBaselines = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  } catch (e) {
    allBaselines = {}
  }
}

const wasMissing = !allBaselines[targetName]
const needsWrite = wasMissing || shouldUpdateBaseline
if (needsWrite) {
  allBaselines[targetName] = metricsData
  fs.writeFileSync(baselinePath, JSON.stringify(allBaselines, null, 2))
  console.log(
    `Metrics baseline ${wasMissing ? 'created' : 'updated'} for target: ${targetName}!`
  )
}

const baseline = allBaselines[targetName]
if (baseline && !shouldUpdateBaseline) {
  console.log('\n=== Metrics vs Baseline ===')

  function calcChange(current: number, baseline: number) {
    const changePercent = ((current - baseline) / baseline) * 100
    const absChange = Math.abs(changePercent)
    const isSignificant = absChange > SIGNIFICANCE_THRESHOLD
    const symbol = current > baseline ? '↑' : current < baseline ? '↓' : '→'
    const colorCode = isSignificant
      ? changePercent > 0
        ? '\u001b[31m'
        : '\u001b[32m'
      : ''
    const resetCode = isSignificant ? '\u001b[39m' : ''
    return {
      change: changePercent.toFixed(1),
      symbol,
      colorCode,
      resetCode,
    }
  }

  const timeChange = calcChange(metricsData.parseTime, baseline.parseTime)
  console.log(
    `${timeLabel}: ${metricsData.parseTime}ms (${timeChange.symbol}${timeChange.colorCode}${timeChange.change}%${timeChange.resetCode})`
  )

  console.log('\nOperation counts:')
  Object.entries(metricsData.operationCounts).forEach(([key, value]) => {
    const change = calcChange(value as number, baseline.operationCounts[key])
    const displayKey = key.replace(/([A-Z])/g, ' $1').toLowerCase()
    console.log(
      `  ${displayKey}: ${(value as number).toLocaleString()} (${change.symbol}${change.colorCode}${change.change}%${change.resetCode})`
    )
  })

  console.log('\nBlock parser changes:')
  for (const name of blockOrder) {
    const current = metricsData.blockParsers[name]
    const baselineParser = baseline.blockParsers[name]

    if (baselineParser && current.attempts > 0) {
      const attemptChange = calcChange(
        current.attempts,
        baselineParser.attempts
      )
      const hitChangePercent =
        current.hits > 0 && baselineParser.hits > 0
          ? ((current.hits - baselineParser.hits) / baselineParser.hits) * 100
          : null
      const hitChange =
        hitChangePercent !== null
          ? calcChange(current.hits, baselineParser.hits)
          : null

      console.log(
        `  ${name.padEnd(15)}: attempts ${attemptChange.symbol}${attemptChange.colorCode}${attemptChange.change}%${attemptChange.resetCode}, hits ${
          hitChange
            ? `${hitChange.symbol}${hitChange.colorCode}${hitChange.change}%${hitChange.resetCode}`
            : 'N/A'
        }`
      )
    }
  }
}
