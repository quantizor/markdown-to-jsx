import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REPO_ROOT } from './metrics-targets.ts'

/**
 * `git merge-base <ref> HEAD` in this checkout, so a comparison against a
 * branch measures only this branch's own changes, not commits that landed on
 * the branch after it forked. Throws with a fix when the ref is unknown.
 */
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

/**
 * Extracts `rev`'s lib/ into a new temporary directory whose lib/node_modules
 * links to this checkout's, and returns that directory as `root` (so
 * `root/lib/src/...` imports work like this checkout's). The directory is
 * removed by `cleanup`, and also when the process exits, since an early
 * `process.exit` skips any pending `finally`.
 */
// Ctrl-C and kill end the process without an 'exit' event; exit explicitly so
// the exit listeners below still remove the extracted trees.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => process.exit(128 + os.constants.signals[signal]))
}

export function extractLib(rev: string): { cleanup: () => void; root: string } {
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
      rev,
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
