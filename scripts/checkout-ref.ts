import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT } from './metrics-targets.ts'

export function mergeBase(ref: string): string {
  const result = spawnSync('git', ['merge-base', ref, 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(
      `cannot find the merge base of ${ref} and HEAD (${result.stderr.trim() || `git exited ${result.status}`}). Fetch the ref first, e.g. git fetch origin main.`
    )
  }
  return result.stdout.trim()
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => process.exit(128 + os.constants.signals[signal]))
}

export function extractLib(rev: string): { cleanup: () => void; root: string } {
  const resolved = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', '--end-of-options', `${rev}^{commit}`],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  )
  if (resolved.status !== 0) {
    throw new Error(
      `"${rev}" names no commit in this repository. Pass a sha, branch, or tag, and fetch it first if it lives only on a remote.`
    )
  }
  const sha = resolved.stdout.trim()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-to-jsx-ref-'))
  const cleanup = () => {
    fs.rmSync(root, { force: true, recursive: true })
    process.off('exit', cleanup)
  }
  process.on('exit', cleanup)
  const archive = spawnSync(
    'bash',
    [
      '-c',
      'set -euo pipefail; git archive "$1" lib | tar -x -C "$2"',
      'archive',
      sha,
      root,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  )
  if (archive.status !== 0) {
    cleanup()
    throw new Error(`git archive ${rev} lib failed: ${archive.stderr.trim()}`)
  }
  fs.symlinkSync(
    path.join(REPO_ROOT, 'lib/node_modules'),
    path.join(root, 'lib/node_modules')
  )
  return { cleanup, root }
}

if (import.meta.main) {
  const rev = process.argv[2]
  if (!rev) {
    console.error(
      "usage: bun scripts/checkout-ref.ts <rev>\nExtracts that commit's lib/ into a kept temporary directory and prints its path."
    )
    process.exit(2)
  }
  try {
    const { cleanup, root } = extractLib(rev)
    process.off('exit', cleanup)
    console.info(root)
    console.error(`remove it with: rm -rf ${root}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}
