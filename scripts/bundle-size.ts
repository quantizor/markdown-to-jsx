#!/usr/bin/env bun
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const LIB = path.join(import.meta.dirname, '../lib')
const PLATFORMS = ['browser', 'node'] as const

const pkg = JSON.parse(fs.readFileSync(path.join(LIB, 'package.json'), 'utf8'))
const entries = Object.keys(pkg.exports).filter(key => key !== './entities')
const external = Object.keys(pkg.peerDependenciesMeta).flatMap(name => [
  name,
  `${name}/*`,
])

if (!fs.existsSync(path.join(LIB, 'dist/index.js'))) {
  console.error(
    'bundle-size: lib/dist is missing. Run `bun run build` first, since the measurement bundles the published files.'
  )
  process.exit(1)
}

const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'mdtj-size-'))
fs.mkdirSync(path.join(consumer, 'node_modules'))
fs.symlinkSync(LIB, path.join(consumer, 'node_modules', pkg.name))

try {
  for (const entry of entries) {
    const specifier = path.posix.join(pkg.name, entry)
    const file = path.join(
      consumer,
      `${entry === '.' ? 'index' : entry.slice(2)}.js`
    )
    fs.writeFileSync(file, `export * from '${specifier}'\n`)

    for (const platform of PLATFORMS) {
      const out = await build({
        absWorkingDir: consumer,
        bundle: true,
        define: { 'process.env.NODE_ENV': '"production"' },
        entryPoints: [file],
        external,
        format: 'esm',
        logLevel: 'error',
        minify: true,
        platform,
        preserveSymlinks: true,
        write: false,
      })
      const code = out.outputFiles[0].contents
      console.log(
        `entry=${specifier} platform=${platform} min=${code.length} gzip=${gzipSync(code, { level: 9 }).length} brotli=${brotliCompressSync(code).length}`
      )
    }
  }
} finally {
  fs.rmSync(consumer, { force: true, recursive: true })
}
