#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { attribution, changesetPath, isAgent } from './changelog.cjs'

interface Contributor {
  email: string
  name: string
  sha: string
  subject: string
  via: 'author' | 'co-author'
}

const who = (credit: Contributor) => `${credit.name} <${credit.email}>`

const CHANGESET_DIR = '.changeset'
const REPO_ROOT = path.resolve(import.meta.dir, '..')

function resolveChangeset(arg: string): string {
  if (arg.includes('/')) {
    return arg.endsWith('.md') ? arg : `${arg}.md`
  }
  return changesetPath(arg.replace(/\.md$/, ''))
}

function pendingChangesets(): string[] {
  const dir = path.join(REPO_ROOT, CHANGESET_DIR)
  if (!fs.existsSync(dir)) {
    return []
  }
  return fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map(name => path.join(CHANGESET_DIR, name))
}

function creditsFor(file: string): {
  credits: Contributor[]
  scope: 'all' | 'head' | 'none'
} {
  const fromHead = attribution(file, { cwd: REPO_ROOT })
  if (fromHead.people.length > 0) {
    return { credits: fromHead.people, scope: 'head' }
  }

  const fromAll = attribution(file, { cwd: REPO_ROOT, revs: ['--all'] })
  return fromAll.people.length > 0
    ? { credits: fromAll.people, scope: 'all' }
    : { credits: [], scope: 'none' }
}

function summaryOf(file: string): string | null {
  const abs = path.join(REPO_ROOT, file)
  if (!fs.existsSync(abs)) {
    return null
  }
  const body = fs.readFileSync(abs, 'utf8').replace(/^---[\s\S]*?---\n/, '')
  return body.trim().split('\n')[0] || '(empty)'
}

const args = process.argv.slice(2)
const files = args.length > 0 ? args.map(resolveChangeset) : pendingChangesets()

if (files.length === 0) {
  console.log('no changesets found')
  process.exit(0)
}

for (const file of files) {
  console.log(path.basename(file, '.md'))

  const summary = summaryOf(file)
  const { credits, scope } = creditsFor(file)

  if (summary !== null) {
    console.log(`  ${summary}`)
  } else if (scope !== 'none') {
    console.log('  (released; file no longer in the tree)')
  }

  if (scope === 'none') {
    console.log(
      summary === null
        ? '  (unknown: no such file and no history under this path)'
        : '  (uncommitted: no git history for this file yet)'
    )
    console.log('')
    continue
  }
  if (scope === 'all') {
    console.log('  (history not reachable from HEAD; read from all refs)')
  }

  const width = Math.max(...credits.map(c => who(c).length))
  const line = (credit: Contributor) => {
    const name = who(credit).padEnd(width)
    const via = credit.via === 'co-author' ? ' [co-author]' : ''
    console.log(`  ${name}  ${credit.sha}  ${credit.subject}${via}`)
  }

  for (const credit of credits.filter(c => !isAgent(c))) {
    line(credit)
  }

  const agents = credits.filter(isAgent)
  if (agents.length > 0) {
    console.log('  not credited (agent or automation; credit the person it')
    console.log('  acted for, unless it originated the work itself):')
    for (const agent of agents) {
      line(agent)
    }
  }
  console.log('')
}
