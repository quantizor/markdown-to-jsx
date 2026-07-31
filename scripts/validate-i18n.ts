import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { SUPPORTED_LANGUAGES } from '../lib/src/i18n/languages.ts'
import { UI_STRINGS } from '../lib/src/i18n/ui-strings.ts'

const REQUIRED_FILES = [
  'README.md',
  'default-template.md',
  'gfm-spec.md',
  'markdown-spec.md',
]

const README_PATHS = [
  'lib/README.md',
  ...SUPPORTED_LANGUAGES.map(lang => `lib/src/i18n/${lang}/README.md`),
]

/**
 * GitHub-flavored heading slug (unicode letters kept; punctuation dropped).
 * TOC anchors may be percent-encoded; decode before comparing.
 */
function githubSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

function decodeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor)
  } catch {
    return anchor
  }
}

function countFences(src: string): number {
  var count = 0
  var lines = src.split('\n')
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```')) {
      count++
    }
  }
  return count
}

function extractTocAnchors(src: string): string[] {
  const anchors: string[] = []
  const tocMatch = src.match(/<!-- TOC -->([\s\S]*?)<!-- \/TOC -->/)
  const block = tocMatch ? tocMatch[1] : ''
  const linkRe = /\[[^\]]*\]\(#([^)]+)\)/g
  var m: RegExpExecArray | null
  while ((m = linkRe.exec(block)) !== null) {
    anchors.push(decodeAnchor(m[1]))
  }
  return anchors
}

/** ATX heading slugs plus explicit HTML heading id attributes. */
function extractHeadingTargets(src: string): Set<string> {
  const targets = new Set<string>()
  const lines = src.split('\n')
  for (var i = 0; i < lines.length; i++) {
    const line = lines[i]
    const atx = /^(#{1,6})\s+(.+)$/.exec(line)
    if (atx) {
      targets.add(githubSlug(atx[2].replace(/#+\s*$/, '').trim()))
    }
    const htmlId = /<h[1-6]\s[^>]*\bid=["']([^"']+)["']/i.exec(line)
    if (htmlId) {
      targets.add(decodeAnchor(htmlId[1]))
    }
  }
  return targets
}

function validateTranslations() {
  const errors: string[] = []

  // 1. Validate UI strings completeness
  const baseKeys = Object.keys(UI_STRINGS.en)

  for (const lang of SUPPORTED_LANGUAGES) {
    const langStrings = UI_STRINGS[lang]
    if (!langStrings) {
      errors.push(`[${lang}] Missing from UI_STRINGS`)
      continue
    }

    const langKeys = Object.keys(langStrings)
    const missing = baseKeys.filter(key => !langKeys.includes(key))
    const extra = langKeys.filter(key => !baseKeys.includes(key))

    if (missing.length > 0) {
      errors.push(`[${lang}] Missing UI strings: ${missing.join(', ')}`)
    }
    if (extra.length > 0) {
      errors.push(`[${lang}] Extra UI strings (not in en): ${extra.join(', ')}`)
    }
  }

  // 2. Validate required documentation files exist
  for (const lang of SUPPORTED_LANGUAGES) {
    for (const file of REQUIRED_FILES) {
      const path = `lib/src/i18n/${lang}/${file}`
      if (!existsSync(path)) {
        errors.push(`[${lang}] Missing file: ${path}`)
      }
    }
  }

  // 3. Validate languages.ts and ui-strings.ts are in sync
  const uiLangs = Object.keys(UI_STRINGS)
  const registryLangs = SUPPORTED_LANGUAGES

  for (const lang of registryLangs) {
    if (!uiLangs.includes(lang)) {
      errors.push(`Language "${lang}" in registry but missing from UI_STRINGS`)
    }
  }

  for (const lang of uiLangs) {
    if (!registryLangs.includes(lang)) {
      errors.push(`Language "${lang}" in UI_STRINGS but missing from registry`)
    }
  }

  // 4. README fence-count parity across canonical + translations
  const fenceCounts = README_PATHS.map(p => {
    if (!existsSync(p)) {
      errors.push(`Missing README: ${p}`)
      return { path: p, count: -1 }
    }
    return { path: p, count: countFences(readFileSync(p, 'utf8')) }
  })
  const baseFence = fenceCounts[0]?.count
  for (const row of fenceCounts) {
    if (row.count >= 0 && row.count !== baseFence) {
      errors.push(
        `${row.path} has ${row.count} fence markers; lib/README.md has ${baseFence}`
      )
    }
  }

  // 5. TOC: every anchor resolves in its own file; TOC entry count matches
  //    lib/README.md. en/ is an exact mirror so its anchor set must match too.
  //    hi/zh may use localized anchors (AGENTS: anchors as each file already does).
  if (existsSync('lib/README.md')) {
    const baseSrc = readFileSync('lib/README.md', 'utf8')
    const baseToc = extractTocAnchors(baseSrc)

    for (const readmePath of README_PATHS) {
      if (!existsSync(readmePath)) {
        continue
      }
      const src = readFileSync(readmePath, 'utf8')
      const headings = extractHeadingTargets(src)
      const toc = extractTocAnchors(src)

      if (toc.length !== baseToc.length) {
        errors.push(
          `${readmePath}: TOC has ${toc.length} entries; lib/README.md has ${baseToc.length}`
        )
      }

      for (const anchor of toc) {
        if (!headings.has(anchor)) {
          errors.push(`${readmePath}: TOC anchor #${anchor} has no heading`)
        }
      }

      if (readmePath === 'lib/src/i18n/en/README.md') {
        for (const anchor of baseToc) {
          if (!toc.includes(anchor)) {
            errors.push(
              `${readmePath}: missing TOC anchor #${anchor} present in lib/README.md`
            )
          }
        }
        for (const anchor of toc) {
          if (!baseToc.includes(anchor)) {
            errors.push(
              `${readmePath}: extra TOC anchor #${anchor} not in lib/README.md`
            )
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('Translation validation failed:\n')
    errors.forEach(err => console.error(`  - ${err}`))
    process.exit(1)
  }

  console.log('All translations are complete!')
}

validateTranslations()
