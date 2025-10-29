export {}

import { removeDebugBunPlugin } from './build-plugins'

const watch = process.argv.includes('--watch')
const minify = !process.argv.includes('--minify=false')

async function build() {
  const plugins = [removeDebugBunPlugin()]

  const result = await Bun.build({
    entrypoints: ['site.tsx'],
    outdir: 'docs',
    format: 'esm',
    minify,
    sourcemap: 'linked',
    target: 'browser',
    plugins,
    define: {
      'process.env.NODE_ENV': '"production"',
      'globalThis.parseMetrics': 'false',
    },
  })

  if (!result.success) {
    console.error('Build failed:')
    for (const error of result.logs) {
      console.error('Error:', error)
    }
    if (!watch) {
      process.exit(1)
    }
    return
  }

  // Rename output file to site.js (ESM format, not IIFE)
  const output = result.outputs[0]
  if (output) {
    const outputPath = output.path
    const targetPath = 'docs/site.js'

    if (outputPath !== targetPath) {
      const content = await output.text()
      await Bun.write(targetPath, content)

      // Handle sourcemap if it exists
      const sourcemapPath = outputPath.replace(/\.js$/, '.js.map')
      const targetSourcemapPath = 'docs/site.js.map'
      try {
        const sourcemapFile = Bun.file(sourcemapPath)
        if (await sourcemapFile.exists()) {
          const sourcemap = await sourcemapFile.text()
          await Bun.write(targetSourcemapPath, sourcemap)
        }
      } catch (e) {
        // Sourcemap might not exist or already be in the right place
      }
    }
  }

  console.log('Site built successfully!')
}

if (watch) {
  await build()

  const server = Bun.serve({
    port: 3000,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname
      const file = Bun.file(`docs${pathname}`)

      if (await file.exists()) {
        return new Response(file)
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  console.log(`Server running at http://localhost:${server.port}`)
  console.log('Watching for changes...')

  const { watch: watchFiles } = await import('fs')
  const watchedFiles = ['site.tsx', 'src']
  const watchers: ReturnType<typeof watchFiles>[] = []

  for (const file of watchedFiles) {
    const watcher = watchFiles(
      file,
      { recursive: true },
      async (eventType, filename) => {
        if (eventType === 'change') {
          console.log(`File changed: ${filename || file}`)
          await build()
        }
      }
    )
    watchers.push(watcher)
  }

  const cleanup = () => {
    console.log('\nShutting down...')
    for (const watcher of watchers) {
      watcher.close()
    }
    server.stop()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
} else {
  await build()
}
