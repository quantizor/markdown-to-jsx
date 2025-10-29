import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { initializeParseMetrics, parser } from '../src/parse.ts'

const markdown = fs.readFileSync('./src/stress-test.generated.md', 'utf8')
const shouldUpdateBaseline = process.argv.includes('-u')

if (!global.gc) {
  throw new Error(
    'Add --expose-gc to your bun command to enable garbage collection'
  )
}

process.stdout.write('Running warmup rounds')
for (let i = 0; i < 50; i++) {
  parser(markdown)
  if (i % 5 === 4) process.stdout.write('.') // Progress indicator
}

global.gc()
global.gc()

process.stdout.write(' Done.\n\n')

// Reset metrics after warmup to only measure the final run
initializeParseMetrics()

const t0 = performance.now()
parser(markdown)
const t1 = performance.now()

const m = global.parseMetrics
if (!m) {
  throw new Error('parseMetrics not initialized')
}

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

function calculateMedian(timings: number[]): number {
  if (timings.length === 0) return 0
  const sorted = timings.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function formatParser(
  name: string,
  data: {
    attempts: number
    hits: number
    hitTimings?: number[]
  }
) {
  const attempts = data.attempts || 0
  const hits = data.hits || 0
  const hitPct = attempts > 0 ? ((hits / attempts) * 100).toFixed(2) : '0.00'
  const missPct =
    attempts > 0 ? (((attempts - hits) / attempts) * 100).toFixed(2) : '0.00'

  // Calculate median hit timing inline (time from attempt to hit)
  const hitTimings = data.hitTimings || []
  const medianHitTime = hitTimings.length > 0 ? calculateMedian(hitTimings) : 0

  let result =
    '  ' +
    name.padEnd(20) +
    'Attempts:' +
    String(attempts).padStart(7) +
    ' Hits:' +
    String(hits).padStart(7) +
    ' (' +
    hitPct +
    '% hit, ' +
    missPct +
    '% miss)'

  if (medianHitTime > 0) {
    // Convert milliseconds to microseconds for readability
    const medianMicroseconds = medianHitTime * 1000
    result += ' [median: ' + medianMicroseconds.toFixed(2) + 'μs]'
  }

  return result
}

console.log('============================================================')
console.log('MARKDOWN PARSING METRICS')
console.log('============================================================')
console.log('')

console.log('Block Parser Performance:')
console.log('------------------------------------------------------------')
for (const name of blockOrder) {
  const data = m.blockParsers[name] || {
    attempts: 0,
    hits: 0,
    hitTimings: [],
  }
  console.log(formatParser(name, data))
}

console.log('')
console.log('Inline Parser Performance:')
console.log('------------------------------------------------------------')
for (const name of inlineOrder) {
  const data = m.inlineParsers[name] || {
    attempts: 0,
    hits: 0,
    hitTimings: [],
  }
  console.log(formatParser(name, data))
}

console.log('')
console.log('Operation Counts:')
console.log('------------------------------------------------------------')
console.log('  Total Operations:      ' + String(m.totalOperations).padStart(6))
console.log(
  '  Block Parse Iterations: ' + String(m.blockParseIterations).padStart(6)
)
console.log(
  '  Inline Parse Iterations: ' + String(m.inlineParseIterations).padStart(6)
)
console.log('============================================================')
console.log('==================================================')
console.log('Input size:', Math.round(markdown.length / 1024) + 'KB')
console.log('Parse time:', (t1 - t0).toFixed(2) + 'ms')
console.log('==================================================')

// Collect metrics data for baseline (excluding raw hitTimings)
const metricsData = {
  timestamp: new Date().toISOString(),
  inputSize: Math.round(markdown.length / 1024),
  parseTime: +(t1 - t0).toFixed(2),
  blockParsers: {} as Record<string, any>,
  inlineParsers: {} as Record<string, any>,
  operationCounts: {
    totalOperations: m.totalOperations,
    blockParseIterations: m.blockParseIterations,
    inlineParseIterations: m.inlineParseIterations,
  },
}

for (const name of blockOrder) {
  const parserData = m.blockParsers[name] || {
    attempts: 0,
    hits: 0,
    hitTimings: [],
  }
  // Exclude hitTimings from baseline to keep it lightweight
  metricsData.blockParsers[name] = {
    attempts: parserData.attempts,
    hits: parserData.hits,
  }
}

for (const name of inlineOrder) {
  const parserData = m.inlineParsers[name] || {
    attempts: 0,
    hits: 0,
    hitTimings: [],
  }
  // Exclude hitTimings from baseline to keep it lightweight
  metricsData.inlineParsers[name] = {
    attempts: parserData.attempts,
    hits: parserData.hits,
  }
}

if (shouldUpdateBaseline) {
  fs.writeFileSync(
    path.join(import.meta.dirname, 'metrics.baseline.json'),
    JSON.stringify(metricsData, null, 2)
  )
  console.log('Metrics baseline updated!')
}

// Compare against baseline (only when not updating)
const baselinePath = path.join(import.meta.dirname, 'metrics.baseline.json')
if (fs.existsSync(baselinePath) && !shouldUpdateBaseline) {
  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))

    console.log('\n=== Metrics vs Baseline ===')

    // Compare parse time
    const parseTimeChangePercent =
      ((metricsData.parseTime - baseline.parseTime) / baseline.parseTime) * 100
    const parseTimeChange = parseTimeChangePercent.toFixed(1)
    const parseTimeSymbol =
      metricsData.parseTime > baseline.parseTime
        ? '↑'
        : metricsData.parseTime < baseline.parseTime
          ? '↓'
          : '→'

    // Colorize only for statistically meaningful changes (>2% absolute)
    const absParseTimeChange = Math.abs(parseTimeChangePercent)
    const isParseTimeSignificant = absParseTimeChange > 2
    const parseTimeColorCode = isParseTimeSignificant
      ? parseTimeChangePercent > 0
        ? '\u001b[31m'
        : '\u001b[32m' // red for regression, green for improvement
      : ''
    const parseTimeResetCode = isParseTimeSignificant ? '\u001b[39m' : ''

    console.log(
      `Parse time: ${metricsData.parseTime}ms (${parseTimeSymbol}${parseTimeColorCode}${parseTimeChange}%${parseTimeResetCode})`
    )

    // Compare operation counts
    console.log('\nOperation counts:')
    Object.entries(metricsData.operationCounts).forEach(([key, value]) => {
      const baselineValue = baseline.operationCounts[key]
      const changePercent =
        (((value as number) - baselineValue) / baselineValue) * 100
      const change = changePercent.toFixed(1)
      const symbol =
        (value as number) > baselineValue
          ? '↑'
          : (value as number) < baselineValue
            ? '↓'
            : '→'

      // Colorize only for statistically meaningful changes (>2% absolute)
      const absChange = Math.abs(changePercent)
      const isSignificant = absChange > 2
      const colorCode = isSignificant
        ? changePercent > 0
          ? '\u001b[31m'
          : '\u001b[32m' // red for increase, green for decrease
        : ''
      const resetCode = isSignificant ? '\u001b[39m' : ''

      const displayKey = key.replace(/([A-Z])/g, ' $1').toLowerCase()
      console.log(
        `  ${displayKey}: ${(
          value as number
        ).toLocaleString()} (${symbol}${colorCode}${change}%${resetCode})`
      )
    })

    // Compare block parsers
    console.log('\nBlock parser changes:')
    for (const name of blockOrder) {
      const current = metricsData.blockParsers[name]
      const baselineParser = baseline.blockParsers[name]

      if (baselineParser && current.attempts > 0) {
        const attemptChangePercent =
          ((current.attempts - baselineParser.attempts) /
            baselineParser.attempts) *
          100
        const attemptChange = attemptChangePercent.toFixed(1)
        const hitChangePercent =
          current.hits > 0 && baselineParser.hits > 0
            ? ((current.hits - baselineParser.hits) / baselineParser.hits) * 100
            : null
        const hitChange =
          hitChangePercent !== null ? hitChangePercent.toFixed(1) : 'N/A'

        const attemptSymbol =
          current.attempts > baselineParser.attempts
            ? '↑'
            : current.attempts < baselineParser.attempts
              ? '↓'
              : '→'
        const hitSymbol =
          hitChange !== 'N/A'
            ? current.hits > baselineParser.hits
              ? '↑'
              : current.hits < baselineParser.hits
                ? '↓'
                : '→'
            : '→'

        // Colorize attempt changes
        const absAttemptChange = Math.abs(attemptChangePercent)
        const isAttemptSignificant = absAttemptChange > 2
        const attemptColorCode = isAttemptSignificant
          ? attemptChangePercent > 0
            ? '\u001b[31m'
            : '\u001b[32m' // red for increase, green for decrease
          : ''
        const attemptResetCode = isAttemptSignificant ? '\u001b[39m' : ''

        // Colorize hit changes
        const absHitChange =
          hitChangePercent !== null ? Math.abs(hitChangePercent) : 0
        const isHitSignificant = hitChange !== 'N/A' && absHitChange > 2
        const hitColorCode = isHitSignificant
          ? hitChangePercent! > 0
            ? '\u001b[31m'
            : '\u001b[32m' // red for increase, green for decrease
          : ''
        const hitResetCode = isHitSignificant ? '\u001b[39m' : ''

        console.log(
          `  ${name.padEnd(
            15
          )}: attempts ${attemptSymbol}${attemptColorCode}${attemptChange}%${attemptResetCode}, hits ${hitSymbol}${hitColorCode}${
            hitChange !== 'N/A' ? hitChange + '%' : hitChange
          }${hitResetCode}`
        )
      }
    }
  } catch (e) {
    console.log('Could not load metrics baseline for comparison')
  }
}
