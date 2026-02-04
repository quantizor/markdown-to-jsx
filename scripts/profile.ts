import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { parser } from '../lib/src/parse.ts'

// ssh mode
console.log = () => {}

async function main() {
  const markdown = fs.readFileSync(path.join(import.meta.dirname, '../lib/src/gfm-spec.md'), 'utf8')

  // Parse --target parameter
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
    // Mock react-native before importing to avoid Flow syntax parsing issues
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
    // This should never happen due to validation above, but satisfies TypeScript
    throw new Error(`Invalid target: ${targetArg}`)
  }

  console.info('Starting profile...')
  console.info('Target:', targetName)
  console.info('Input size:', Math.round(markdown.length / 1024) + 'KB')

  const t0 = performance.now()
  const numberOfIterations = 1000

  // Run compiler multiple times to get good sampling
  for (let i = 0; i < numberOfIterations; i++) {
    compiler(markdown)
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
