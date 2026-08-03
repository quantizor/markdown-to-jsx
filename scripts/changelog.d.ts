/**
 * Types for scripts/changelog.cjs, which stays CommonJS because changesets
 * loads it with `require` and this package is `"type": "module"`. Without this
 * file the importing script sees `any` for every export, and the two could
 * disagree about the attribution shape with nothing to catch it.
 */

/** One person credited on a changeset, with the commit that put them there. */
export interface Contributor {
  email: string
  name: string
  sha: string
  subject: string
  via: 'author' | 'co-author'
}

/** Who and what is behind a changeset file. */
export interface Attribution {
  /** Abbreviated hashes of every commit that added or modified the file. */
  commits: string[]
  /** Message from git when the query itself failed. */
  error?: string
  /** Authors and co-authors, first appearance first, deduplicated by email. */
  people: Contributor[]
  /**
   * False when any commit came back without a parent, which means a shallow
   * clone where every file reads as added by the boundary commit.
   */
  trustworthy: boolean
}

export function attribution(
  file: string,
  options?: { cwd?: string; revs?: string[] }
): Attribution

/** Repo-relative path of a changeset file, given its id. */
export function changesetPath(id: string): string

/** True for an agent or automation identity, which is never thanked. */
export function isAgent(person: Pick<Contributor, 'email' | 'name'>): boolean

/** True when the person is one of the configured maintainers. */
export function isMaintainer(
  person: Pick<Contributor, 'email' | 'name'>,
  maintainers: string[]
): boolean
