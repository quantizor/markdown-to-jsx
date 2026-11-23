'use strict'
const { execFileSync } = require('node:child_process')

const ATTRIBUTION_LOG_ARGS = ['log', '--reverse', '--diff-filter=AM']

const AGENT_EMAILS = [
  'copilot@',
  'cursoragent',
  'devin-ai-integration',
  'noreply@anthropic.com',
]

const FIELD = '\x1f'
const RECORD = '\x02'
const TRAILER = '\x1e'

const LOG_FORMAT = [
  '%h',
  '%p',
  '%an',
  '%ae',
  '%s',
  `%(trailers:key=Co-authored-by,valueonly,separator=${TRAILER})`,
].join(FIELD)

function changesetPath(id) {
  return `.changeset/${id}.md`
}

function isAgent(person) {
  const email = person.email.toLowerCase()
  return (
    person.name.toLowerCase().endsWith('[bot]') ||
    AGENT_EMAILS.some(fragment => email.includes(fragment))
  )
}

function parseTrailer(value) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  return match ? { email: match[2], name: match[1] } : null
}

function attribution(file, options) {
  const cwd = options?.cwd || process.cwd()
  const revs = options?.revs || []

  let stdout
  try {
    stdout = execFileSync(
      'git',
      [
        ...ATTRIBUTION_LOG_ARGS,
        ...revs,
        `--format=${RECORD}${LOG_FORMAT}`,
        '--',
        file,
      ],
      { cwd, encoding: 'utf8' }
    )
  } catch (error) {
    return { commits: [], people: [], trustworthy: false, error: error.message }
  }

  const commits = []
  const people = []
  const seen = new Set()
  let trustworthy = true

  for (const record of stdout.split(RECORD)) {
    if (!record.trim()) {
      continue
    }
    const [sha, parents, name, email, subject, trailers] = record.split(FIELD)
    if (!parents) {
      trustworthy = false
    }
    commits.push(sha)

    const add = person => {
      const key = person.email.toLowerCase()
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      people.push(person)
    }

    add({ email, name, sha, subject, via: 'author' })

    for (const value of (trailers || '').split(TRAILER)) {
      if (!value.trim()) {
        continue
      }
      const person = parseTrailer(value)
      if (person) {
        add({ ...person, sha, subject, via: 'co-author' })
      }
    }
  }

  return { commits, people, trustworthy }
}

function isMaintainer(person, maintainers) {
  const name = person.name.toLowerCase()
  const email = person.email.toLowerCase()
  return maintainers.some(entry => {
    const needle = entry.toLowerCase()
    return name === needle || email === needle || email.includes(needle)
  })
}

const NAMES = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' })

const getReleaseLine = async (changeset, _type, options) => {
  const maintainers = options?.maintainers || []
  const [firstLine, ...futureLines] = changeset.summary
    .split('\n')
    .map(line => line.trimEnd())

  const found = attribution(changesetPath(changeset.id), {})
  const usable = found.trustworthy && found.commits.length > 0
  if (!usable && found.commits.length > 0) {
    console.warn(
      `changelog: ${changesetPath(changeset.id)} has a parentless commit in ` +
        'its history, which means a shallow clone. Falling back to the single ' +
        'commit changesets resolved; check out full history to fix.'
    )
  }

  const cited = usable
    ? found.commits
    : changeset.commit
      ? [changeset.commit.slice(0, 7)]
      : []

  let returnVal = `- ${cited.length > 0 ? `${cited.join(', ')}: ` : ''}${firstLine}`

  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map(line => `  ${line}`).join('\n')}`
  }

  if (usable) {
    const summary = changeset.summary.toLowerCase()
    const thanks = found.people
      .filter(person => !isAgent(person))
      .filter(person => !isMaintainer(person, maintainers))
      .filter(person => !summary.includes(person.name.toLowerCase()))
      .map(person => person.name)

    if (thanks.length > 0) {
      returnVal += `\n\n  Thanks ${NAMES.format(thanks)}!`
    }
  }

  return returnVal
}

const getDependencyReleaseLine = async (changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) {
    return ''
  }

  const changesetLinks = changesets.map(
    changeset =>
      `- Updated dependencies${changeset.commit ? ` [${changeset.commit.slice(0, 7)}]` : ''}`
  )
  const updatedDependenciesList = dependenciesUpdated.map(
    dependency => `  - ${dependency.name}@${dependency.newVersion}`
  )

  return [...changesetLinks, ...updatedDependenciesList].join('\n')
}

module.exports = {
  attribution,
  changesetPath,
  getDependencyReleaseLine,
  getReleaseLine,
  isAgent,
  isMaintainer,
}
