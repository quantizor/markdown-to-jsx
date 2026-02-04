#!/usr/bin/env node

/**
 * Build script to generate HTML entity constants
 * Reads vendored data/entities.json (sourced from https://html.spec.whatwg.org/entities.json)
 * for CommonMark compliance
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Entities required for CommonMark spec compliance
// These match the entities used in CommonMark spec examples
const REQUIRED_ENTITIES = [
  // Basic ASCII entities (required for HTML escaping)
  'amp',
  'apos',
  'gt',
  'lt',
  'quot',
  'nbsp',
  // CommonMark spec test entities
  'copy',
  'AElig',
  'aelig',
  'frac34',
  'HilbertSpace',
  'DifferentialD',
  'ClockwiseContourIntegral',
  'ouml',
  'Ouml',
  'auml',
  'Auml',
  'Dcaron',
  'dcaron',
  'ngE',
  'nge',
]

function loadEntitiesFromVendoredFile(): Array<{
  name: string
  codepoints: number[]
}> {
  const filePath = path.join(__dirname, '..', 'lib', 'data', 'entities.json')
  const raw = fs.readFileSync(filePath, 'utf8')
  const entitiesJson = JSON.parse(raw)

  const entities: Array<{ name: string; codepoints: number[] }> = []

  for (const [key, value] of Object.entries(entitiesJson)) {
    if (key.startsWith('&') && key.endsWith(';')) {
      const name = key.slice(1, -1)
      const entity = value as { codepoints: number[] }
      if (entity.codepoints) {
        entities.push({ name, codepoints: entity.codepoints })
      }
    }
  }

  // Sort by name for binary search
  entities.sort((a, b) => a.name.localeCompare(b.name))

  return entities
}

/**
 * Convert code point(s) to Unicode string
 */
function decodeCodepoints(codepoints: number[]): string {
  let result = ''
  for (let i = 0; i < codepoints.length; i++) {
    const cp = codepoints[i]
    if (cp <= 0xffff) {
      result += String.fromCharCode(cp)
    } else {
      const adjusted = cp - 0x10000
      result += String.fromCharCode(
        0xd800 + (adjusted >> 10),
        0xdc00 + (adjusted & 0x3ff)
      )
    }
  }
  return result
}

function generateEntityConstants(
  entities: Array<{ name: string; codepoints: number[] }>
): string {
  // Build simple object mapping entity names to Unicode strings
  // Store only lowercase versions when case variants map to the same Unicode (saves ~8.8 KB)
  const entityMap: Record<string, string> = {}
  const unicodeByLowercase: Record<string, string> = {}

  // First pass: collect all entities and group by lowercase name
  for (const { name, codepoints } of entities) {
    const unicode = decodeCodepoints(codepoints)
    const lowerName = name.toLowerCase()

    // If we've seen this lowercase name before, check if Unicode matches
    if (unicodeByLowercase[lowerName]) {
      if (unicodeByLowercase[lowerName] === unicode) {
        // Same Unicode - this is a duplicate, skip it
        continue
      } else {
        // Different Unicode - keep both (case matters for this entity)
        entityMap[name] = unicode
      }
    } else {
      // First time seeing this lowercase name
      unicodeByLowercase[lowerName] = unicode
      // Store lowercase version (will be overridden if case matters)
      entityMap[lowerName] = unicode
    }
  }

  // Second pass: for entities where case matters (different Unicode), store the uppercase version
  for (const { name, codepoints } of entities) {
    const unicode = decodeCodepoints(codepoints)
    const lowerName = name.toLowerCase()

    // If the lowercase version exists but maps to different Unicode, store the uppercase too
    if (
      lowerName !== name &&
      entityMap[lowerName] &&
      entityMap[lowerName] !== unicode
    ) {
      entityMap[name] = unicode
    }
  }

  // Third pass: special case handling for backward compatibility
  // Some lowercase entities (like aelig) should prefer the "first two uppercase" variant (AElig)
  // This preserves old behavior where &aelig; decoded to Æ instead of æ
  for (const { name, codepoints } of entities) {
    const unicode = decodeCodepoints(codepoints)
    const lowerName = name.toLowerCase()

    if (lowerName === name && name.length >= 2) {
      // This is a lowercase entity - check if there's a "first two uppercase" variant
      const upperFirstTwo = name.slice(0, 2).toUpperCase() + name.slice(2)
      const upperFirst = name.charAt(0).toUpperCase() + name.slice(1)

      // If upperFirstTwo exists and maps to different Unicode, prefer it (e.g., aelig -> AElig)
      if (
        upperFirstTwo !== name &&
        entityMap[upperFirstTwo] &&
        entityMap[upperFirstTwo] !== unicode &&
        !entityMap[upperFirst]
      ) {
        entityMap[lowerName] = entityMap[upperFirstTwo]
      }
    }
  }

  // Generate object literal string
  // Sort by Unicode value first (for better gzip compression), then by name
  // This groups entities with the same Unicode character together, creating more repetition
  const entries = Object.entries(entityMap)
    .sort((a, b) => {
      const unicodeCompare = a[1].localeCompare(b[1])
      if (unicodeCompare !== 0) return unicodeCompare
      return a[0].localeCompare(b[0])
    })
    .map(([name, unicode]) => {
      // Escape quotes and backslashes in entity name
      const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      // Escape quotes, backslashes, and newlines in Unicode string
      const escapedUnicode = unicode
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
      return `  "${escapedName}":"${escapedUnicode}"`
    })
    .join(',\n')

  return (
    '/**\n' +
    ' * Auto-generated HTML entity mappings for CommonMark compliance\n' +
    ' * Source: data/entities.json (vendored from https://html.spec.whatwg.org/entities.json)\n' +
    ' * Generated by scripts/generate-entities.ts\n' +
    ' * \n' +
    ' * Simple object mapping entity names to Unicode characters.\n' +
    ' * Stores only lowercase versions when case variants map to the same Unicode (saves ~8.8 KB).\n' +
    ' * Case-sensitive entities (where uppercase/lowercase differ) are stored with both keys.\n' +
    ' */\n' +
    '\n' +
    'export const NAMED_CODES_TO_UNICODE: Record<string, string> = {\n' +
    entries +
    '\n}\n' +
    '\n' +
    '/**\n' +
    ' * Decode a named entity using the lookup table.\n' +
    ' * Returns the decoded character or undefined if not found.\n' +
    ' * This function enables browser builds to swap in DOM-based decoding.\n' +
    ' */\n' +
    'export function decodeEntity(name: string): string | undefined {\n' +
    '  return NAMED_CODES_TO_UNICODE[name] || NAMED_CODES_TO_UNICODE[name.toLowerCase()]\n' +
    '}\n'
  )
}

function main() {
  try {
    console.log('Loading entities from vendored data/entities.json...')
    const entities = loadEntitiesFromVendoredFile()

    const outputPath = path.join(
      __dirname,
      '..',
      'lib',
      'src',
      'entities.generated.ts'
    )
    const content = generateEntityConstants(entities)

    fs.writeFileSync(outputPath, content, 'utf8')

    const stats = fs.statSync(outputPath)
    console.log(
      `✅ Generated ${entities.length} entity mappings (${(
        stats.size / 1024
      ).toFixed(1)} KB) in ${outputPath}`
    )
  } catch (error) {
    console.error('Error generating entities:', error)
    process.exit(1)
  }
}

if (import.meta.url === 'file://' + process.argv[1]) {
  main()
}
