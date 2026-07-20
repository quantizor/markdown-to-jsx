import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { parser } from '../lib/src/parse.ts'

// ssh mode
console.log = () => {}

async function main() {
  const fileArg = process.argv.indexOf('--file')
  const filePath = fileArg !== -1 ? process.argv[fileArg + 1] : path.join(import.meta.dirname, '../lib/src/gfm-spec.md')
  const markdown = fs.readFileSync(filePath, 'utf8')

  // Parse flags
  const isStreaming = process.argv.includes('--streaming')
  const targetIndex = process.argv.indexOf('--target')
  const targetArg =
    targetIndex !== -1 ? process.argv[targetIndex + 1] : 'parser'
  const validTargets = [
    'parser',
    'react',
    'react-native',
    'html',
    'solid',
    'vue',
    'markdown',
  ]
  if (!validTargets.includes(targetArg)) {
    console.error(
      `Invalid target: ${targetArg}. Valid targets are: ${validTargets.join(', ')}`
    )
    process.exit(1)
  }

  // Import compiler based on target
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
    // Reuse the canonical react-native mock so this harness cannot drift from
    // the components native.tsx actually imports. Registering it must precede
    // the native.tsx import so the mocked module resolves first.
    await import('../lib/src/__mocks__/react-native.ts')

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
  } else if (targetArg === 'markdown') {
    const mdModule = await import('../lib/src/markdown.ts')
    compiler = mdModule.compiler
    targetName = 'markdown'
  } else {
    // This should never happen due to validation above, but satisfies TypeScript
    throw new Error(`Invalid target: ${targetArg}`)
  }

  const compilerOpts = isStreaming ? { optimizeForStreaming: true } : undefined

  console.info('Starting profile...')
  console.info('Target:', targetName + (isStreaming ? ' (streaming)' : ''))
  console.info('Input size:', Math.round(markdown.length / 1024) + 'KB')

  const t0 = performance.now()
  const numberOfIterations = 1000

  // Run compiler multiple times to get good sampling
  for (let i = 0; i < numberOfIterations; i++) {
    compiler(markdown, compilerOpts)
  }

  const t1 = performance.now()

  console.info(
    `Completed ${numberOfIterations} iterations in`,
    (t1 - t0).toFixed(2) + 'ms'
  )
  console.info(
    'Average per iteration:',
    ((t1 - t0) / numberOfIterations).toFixed(2) + 'ms'
  )

  // CPU profile will be written by Bun when this process exits
  // The profile resolution happens automatically in the next step of the pipeline
}

main().catch(console.error)
