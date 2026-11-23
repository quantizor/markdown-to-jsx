export interface Contributor {
  email: string
  name: string
  sha: string
  subject: string
  via: 'author' | 'co-author'
}

export interface Attribution {
  commits: string[]
  error?: string
  people: Contributor[]
  trustworthy: boolean
}

export function attribution(
  file: string,
  options?: { cwd?: string; revs?: string[] }
): Attribution

export function changesetPath(id: string): string

export function isAgent(person: Pick<Contributor, 'email' | 'name'>): boolean

export function isMaintainer(
  person: Pick<Contributor, 'email' | 'name'>,
  maintainers: string[]
): boolean
