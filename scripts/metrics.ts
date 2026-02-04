import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { parser } from '../lib/src/parse.ts'

const WARMUP_ROUNDS = 50
const SIGNIFICANCE_THRESHOLD = 2

const markdown = fs.readFileSync(path.join(import.meta.dirname, '../lib/src/stress-test.generated.md'), 'utf8')
const shouldUpdateBaseline = process.argv.includes('-u')

const targetIndex = process.argv.indexOf('--target')
const targetArg = targetIndex !== -1 ? process.argv[targetIndex + 1] : 'parser'
const validTargets = ['parser', 'react', 'react-native', 'html', 'solid', 'vue']
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
  const reactModule = await import('../lib/src/react.tsx')
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

  const nativeModule = await import('../lib/src/native.tsx')
  compiler = nativeModule.compiler
  targetName = 'react-native'
} else if (targetArg === 'html') {
  const htmlModule = await import('../lib/src/html.ts')
  compiler = htmlModule.compiler
  targetName = 'html'
} else if (targetArg === 'solid') {
  const solidModule = await import('../lib/src/solid.tsx')
  compiler = solidModule.compiler
  targetName = 'solid'
} else if (targetArg === 'vue') {
  const vueModule = await import('../lib/src/vue.tsx')
  compiler = vueModule.compiler
  targetName = 'vue'
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

const t0 = performance.now()
compiler(markdown)
const t1 = performance.now()

const isParserTarget = targetArg === 'parser'
const timeLabel = isParserTarget ? 'Parse time' : 'Total time'

console.log('==================================================')
console.log(`Input size: ${Math.round(markdown.length / 1024)}KB`)
console.log(`${timeLabel}: ${(t1 - t0).toFixed(2)}ms`)
console.log('==================================================')

const metricsData = {
  timestamp: new Date().toISOString(),
  target: targetName,
  inputSize: Math.round(markdown.length / 1024),
  parseTime: +(t1 - t0).toFixed(2),
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
}
