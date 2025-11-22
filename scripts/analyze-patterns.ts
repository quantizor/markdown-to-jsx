#!/usr/bin/env bun

/**
 * Code pattern analysis tool for identifying duplicate patterns and consolidation opportunities
 *
 * Usage:
 *   bun scripts/analyze-patterns.ts [options]
 *
 * Options:
 *   --duplicates    Find duplicate code patterns
 *   --helpers       Find inline patterns that could use helpers
 *   --unused        Find functions used only once (candidate for inlining)
 *   --similar       Find similar code blocks (slow, disabled by default)
 *   --heuristics    Run 10 heuristic pattern checks (enabled by default)
 *   --all           Run all analyses including slow ones
 *
 * Heuristic Checks:
 *   1. Repeated conditional patterns (if/else blocks)
 *   2. Repeated string operations (.slice().trim(), chained .replace(), etc.)
 *   3. Repeated variable assignment patterns
 *   4. Repeated function call sequences (A() -> B() patterns)
 *   5. Repeated error handling patterns (return null/false)
 *   6. Repeated loop patterns
 *   7. Repeated object access patterns (.property.subproperty)
 *   8. Repeated type checking patterns (typeof, instanceof, Array.isArray)
 *   9. Repeated calculation patterns (Math.*, ternary with numbers)
 *   10. Repeated validation patterns (bounds checks, null checks)
 */

import fs from 'fs'
import path from 'path'

interface PatternMatch {
  file: string
  line: number
  code: string
  context?: string
}

interface DuplicatePattern {
  pattern: string
  occurrences: PatternMatch[]
  suggestion?: string
}

interface HelperOpportunity {
  pattern: string
  occurrences: PatternMatch[]
  suggestedHelper: string
  estimatedSavings: number
}

interface FunctionUsage {
  name: string
  definition: { file: string; line: number }
  usages: Array<{ file: string; line: number }>
  canInline: boolean
}

interface HeuristicPattern {
  type: string
  description: string
  occurrences: PatternMatch[]
  suggestion: string
  confidence: number // 0-1
}

// Common patterns to look for
const COMMON_PATTERNS = [
  {
    name: 'skipToNextLine pattern',
    regex: /(\w+)\s*\+\s*\(\s*\1\s*<\s*[^)]+\.length\s*\?\s*1\s*:\s*0\s*\)/g,
    suggestion: 'Use skipToNextLine() helper',
  },
  {
    name: 'findLineEnd pattern',
    regex: /source\.indexOf\(['"]\\n['"],\s*(\w+)\)/g,
    suggestion: 'Use findLineEnd() helper',
  },
  {
    name: 'charCodeAt comparison',
    regex: /(\w+)\.charCodeAt\(0\)\s*===\s*\$\.CHAR_/g,
    suggestion: 'Consider using helper functions',
  },
  {
    name: 'whitespace check',
    regex: /(\w+)\s*===\s*['"]\s['"]\s*\|\|\s*\1\s*===\s*['"]\\t['"]/g,
    suggestion: 'Use isWS() or isASCIIWhitespace()',
  },
  {
    name: 'manual trim',
    regex: /\.trim\(\)/g,
    suggestion: 'Check if trimEnd() helper exists',
  },
]

// Read and parse source file
function readSourceFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

// Find duplicate patterns
function findDuplicatePatterns(source: string, filePath: string): DuplicatePattern[] {
  const lines = source.split('\n')
  const duplicates: DuplicatePattern[] = []

  // Find repeated code blocks (3+ lines, appearing 2+ times)
  const codeBlocks = new Map<string, PatternMatch[]>()

  // Limit scanning to avoid slowdown
  const MAX_SCAN = 2000
  const step = lines.length > MAX_SCAN ? Math.floor(lines.length / MAX_SCAN) : 1

  for (let i = 0; i < lines.length - 2; i += step) {
    const block = lines.slice(i, i + 3).join('\n').trim()
    if (block.length > 20 && block.length < 500 && // Reasonable size
        !block.includes('function ') && !block.includes('var ') &&
        !block.includes('const ') && !block.includes('export ')) {
      if (!codeBlocks.has(block)) {
        codeBlocks.set(block, [])
      }
      codeBlocks.get(block)!.push({
        file: filePath,
        line: i + 1,
        code: block,
      })
    }
  }

  for (const [pattern, occurrences] of codeBlocks.entries()) {
    if (occurrences.length >= 2) {
      duplicates.push({
        pattern,
        occurrences,
      })
    }
  }

  return duplicates
}

// Check if a line is a function definition
function isFunctionDefinition(line: string): boolean {
  return /^\s*(?:function\s+\w+|var\s+\w+\s*=\s*function|const\s+\w+\s*=\s*function|var\s+\w+\s*=\s*\(|const\s+\w+\s*=\s*\()/.test(line)
}

// Check if a line is a comment
function isComment(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

// Check if a line is a type definition
function isTypeDefinition(line: string): boolean {
  return /^\s*(?:type|interface|type\s+\w+\s*=|interface\s+\w+\s*\{)/.test(line)
}

// Check if pattern is already a helper function
function isAlreadyHelper(source: string, patternName: string): boolean {
  // Check if there's already a helper function for this pattern
  const helperPatterns: Record<string, RegExp> = {
    'skipToNextLine pattern': /(?:function|var|const)\s+skipToNextLine\s*[=\(]/,
    'whitespace check': /(?:function|var|const)\s+(?:isWS|isSpaceOrTab|isASCIIWhitespace|isUnicodeWhitespace)\s*[=\(]/,
    'charCodeAt comparison': /(?:function|var|const)\s+charCode\s*[=\(]/,
  }
  const regex = helperPatterns[patternName]
  return regex ? regex.test(source) : false
}

// Find helper opportunities
function findHelperOpportunities(source: string, filePath: string): HelperOpportunity[] {
  const opportunities: HelperOpportunity[] = []
  const lines = source.split('\n')

  for (const pattern of COMMON_PATTERNS) {
    // Skip if already a helper exists
    if (isAlreadyHelper(source, pattern.name)) continue

    const matches: PatternMatch[] = []
    let match: RegExpExecArray | null

    // Reset regex
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags)

    while ((match = regex.exec(source)) !== null) {
      const lineNum = source.substring(0, match.index).split('\n').length
      const line = lines[lineNum - 1] || ''

      // Filter out function definitions, comments, and type definitions
      if (isFunctionDefinition(line) || isComment(line) || isTypeDefinition(line)) {
        continue
      }

      matches.push({
        file: filePath,
        line: lineNum,
        code: line.trim(),
        context: lines.slice(Math.max(0, lineNum - 2), lineNum + 1).join('\n'),
      })
    }

    // Require at least 2 real occurrences (not function definitions)
    if (matches.length >= 2) {
      opportunities.push({
        pattern: pattern.name,
        occurrences: matches,
        suggestedHelper: pattern.suggestion || 'Create helper function',
        estimatedSavings: matches.length * 5, // Rough estimate
      })
    }
  }

  return opportunities
}

// Find function definitions and usages
function analyzeFunctionUsage(source: string, filePath: string): FunctionUsage[] {
  const functions: FunctionUsage[] = []
  const lines = source.split('\n')

  // Find function definitions
  const functionDefRegex = /(?:function\s+(\w+)|var\s+(\w+)\s*=\s*function|const\s+(\w+)\s*=\s*function)/g
  let match: RegExpExecArray | null

  while ((match = functionDefRegex.exec(source)) !== null) {
    const funcName = match[1] || match[2] || match[3]
    const lineNum = source.substring(0, match.index).split('\n').length

    // Find usages
    const usageRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g')
    const usages: Array<{ file: string; line: number }> = []
    let usageMatch: RegExpExecArray | null

    const sourceAfterDef = source.substring(match.index + match[0].length)
    while ((usageMatch = usageRegex.exec(sourceAfterDef)) !== null) {
      const usageLineNum = sourceAfterDef.substring(0, usageMatch.index).split('\n').length + lineNum
      usages.push({
        file: filePath,
        line: usageLineNum,
      })
    }

    functions.push({
      name: funcName,
      definition: { file: filePath, line: lineNum },
      usages,
      canInline: usages.length === 1 && !funcName.startsWith('parse') && !funcName.startsWith('create'),
    })
  }

  return functions
}

// Find similar code blocks using simple similarity
function findSimilarBlocks(source: string, filePath: string, minSimilarity = 0.7): PatternMatch[] {
  const lines = source.split('\n')
  const blocks: Array<{ start: number; end: number; code: string; hash: string }> = []

  // Extract code blocks (5-10 lines, more limited to avoid O(n²) explosion)
  const MAX_BLOCKS = 500 // Limit to prevent slowdown
  for (let i = 0; i < lines.length - 4 && blocks.length < MAX_BLOCKS; i += 3) { // Skip every 3 lines
    for (let len = 5; len <= 10 && i + len <= lines.length; len += 2) { // Skip odd lengths
      const block = lines.slice(i, i + len).join('\n')
      if (block.trim().length > 30 && !block.includes('function ')) {
        // Use a simple hash to quickly identify potential duplicates
        const hash = simpleHash(block)
        blocks.push({ start: i, end: i + len, code: block, hash })
      }
    }
  }

  const similar: PatternMatch[] = []
  const checked = new Set<string>()

  // Compare blocks for similarity (limited comparisons)
  const MAX_COMPARISONS = 1000
  let comparisons = 0

  for (let i = 0; i < blocks.length && comparisons < MAX_COMPARISONS; i++) {
    if (checked.has(blocks[i].hash)) continue

    for (let j = i + 1; j < blocks.length && comparisons < MAX_COMPARISONS; j++) {
      comparisons++
      // Quick check: if hashes are similar, do deeper comparison
      if (blocks[i].hash === blocks[j].hash ||
          Math.abs(blocks[i].code.length - blocks[j].code.length) < blocks[i].code.length * 0.2) {
        const similarity = calculateSimilarity(blocks[i].code, blocks[j].code)
        if (similarity >= minSimilarity) {
          similar.push({
            file: filePath,
            line: blocks[i].start + 1,
            code: blocks[i].code.substring(0, 200) + '...',
          })
          checked.add(blocks[i].hash)
          break // Only report first occurrence
        }
      }
    }
  }

  return similar
}

function simpleHash(str: string): string {
  // Simple hash for quick comparison
  let hash = 0
  const sample = str.replace(/\s+/g, ' ').substring(0, 100) // Sample first 100 chars
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

// Simple similarity calculation (faster approximation)
function calculateSimilarity(str1: string, str2: string): number {
  // Normalize whitespace
  const norm1 = str1.replace(/\s+/g, ' ').trim()
  const norm2 = str2.replace(/\s+/g, ' ').trim()

  if (norm1 === norm2) return 1.0

  // Quick length check
  const lenDiff = Math.abs(norm1.length - norm2.length)
  const maxLen = Math.max(norm1.length, norm2.length)
  if (lenDiff / maxLen > 0.3) return 0 // Too different in length

  // Use character frequency as a fast similarity metric
  const chars1 = getCharFreq(norm1.substring(0, 200)) // Sample first 200 chars
  const chars2 = getCharFreq(norm2.substring(0, 200))

  let matches = 0
  let total = 0
  const allChars = new Set([...Object.keys(chars1), ...Object.keys(chars2)])

  for (const char of allChars) {
    const count1 = chars1[char] || 0
    const count2 = chars2[char] || 0
    total += Math.max(count1, count2)
    matches += Math.min(count1, count2)
  }

  return total > 0 ? matches / total : 0
}

function getCharFreq(str: string): Record<string, number> {
  const freq: Record<string, number> = {}
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1
  }
  return freq
}

// Heuristic analysis functions
function findRepeatedConditionalPatterns(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const conditionals = new Map<string, PatternMatch[]>()

  // Find if/else patterns
  const ifPattern = /if\s*\([^)]+\)\s*\{/
  const elsePattern = /\}\s*else\s*\{/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip comments, type definitions, and function definitions
    if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
      continue
    }

    if (ifPattern.test(line)) {
      // Find the complete if-else block
      let depth = 0
      let blockEnd = i
      let hasElse = false

      for (let j = i; j < lines.length && j < i + 20; j++) {
        const blockLine = lines[j]
        if (ifPattern.test(blockLine)) depth++
        if (elsePattern.test(blockLine)) hasElse = true
        if (blockLine.includes('}')) depth--
        if (depth === 0 && j > i) {
          blockEnd = j
          break
        }
      }

      if (hasElse && blockEnd > i) {
        const block = lines.slice(i, blockEnd + 1).join('\n')
        // More specific normalization - preserve structure
        const normalized = block
          .replace(/\s+/g, ' ')
          .replace(/\d+/g, 'N')
          .replace(/['"][^'"]+['"]/g, 'STR')
          .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')

        // Require pattern to be substantial (not just generic if/else)
        if (normalized.length < 30) continue

        if (!conditionals.has(normalized)) {
          conditionals.set(normalized, [])
        }
        conditionals.get(normalized)!.push({
          file: filePath,
          line: i + 1,
          code: block.substring(0, 150),
        })
      }
    }
  }

  for (const [pattern, occurrences] of conditionals.entries()) {
    // Require at least 2 occurrences and pattern must be specific enough
    if (occurrences.length >= 2 && pattern.length > 50) {
      patterns.push({
        type: 'repeated-conditionals',
        description: `Repeated if/else conditional patterns (${occurrences.length} occurrences)`,
        occurrences,
        suggestion: 'Extract to helper function or use lookup table',
        confidence: 0.7,
      })
    }
  }

  return patterns
}

function findRepeatedStringOperations(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const operations = new Map<string, PatternMatch[]>()

  // Find common string operation patterns
  const stringOpPatterns = [
    /\.slice\([^)]+\)\.trim\(\)/g,
    /\.indexOf\([^)]+\)\s*[!=]==?\s*-1/g,
    /\.charCodeAt\(0\)\s*===\s*\$\.CHAR_/g,
    /\.replace\([^)]+\)\.replace\([^)]+\)/g, // Chained replaces
  ]

  for (const regex of stringOpPatterns) {
    let match: RegExpExecArray | null
    const found = new Map<string, PatternMatch[]>()

    while ((match = regex.exec(source)) !== null) {
      const lineNum = source.substring(0, match.index).split('\n').length
      const line = lines[lineNum - 1] || ''

      // Filter out function definitions, comments, and type definitions
      if (isFunctionDefinition(line) || isComment(line) || isTypeDefinition(line)) {
        continue
      }

      const normalized = match[0].replace(/\d+/g, 'N').replace(/['"][^'"]+['"]/g, 'STR')

      if (!found.has(normalized)) {
        found.set(normalized, [])
      }
      found.get(normalized)!.push({
        file: filePath,
        line: lineNum,
        code: line.trim(),
      })
    }

    for (const [pattern, occurrences] of found.entries()) {
      // Require at least 3 occurrences
      if (occurrences.length >= 3) {
        operations.set(pattern, occurrences)
      }
    }
  }

  if (operations.size > 0) {
    patterns.push({
      type: 'repeated-string-ops',
      description: 'Repeated string operation patterns',
      occurrences: Array.from(operations.values()).flat(),
      suggestion: 'Consider helper functions for common string operations',
      confidence: 0.8,
    })
  }

  return patterns
}

function findRepeatedVariablePatterns(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const assignments = new Map<string, PatternMatch[]>()

  // Find variable assignment patterns
  const assignPattern = /(?:var|let|const)\s+(\w+)\s*=\s*(.+);?/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip comments, type definitions, and function definitions
    if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
      continue
    }

    const match = line.match(assignPattern)
    if (match) {
      const normalized = match[2]
        .replace(/\d+/g, 'N')
        .replace(/['"][^'"]+['"]/g, 'STR')
        .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')
        .trim()

      // Require substantial patterns, exclude generic ones
      if (normalized.length > 15 && normalized.length < 100 &&
          !normalized.match(/^VAR\s*=\s*VAR$/)) {
        if (!assignments.has(normalized)) {
          assignments.set(normalized, [])
        }
        assignments.get(normalized)!.push({
          file: filePath,
          line: i + 1,
          code: line.trim(),
        })
      }
    }
  }

  for (const [pattern, occurrences] of assignments.entries()) {
    // Require at least 3 occurrences
    if (occurrences.length >= 3) {
      patterns.push({
        type: 'repeated-assignments',
        description: `Repeated variable assignment patterns (${occurrences.length} occurrences)`,
        occurrences,
        suggestion: 'Extract to helper function',
        confidence: 0.6,
      })
    }
  }

  return patterns
}

function findRepeatedFunctionCallSequences(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const sequences = new Map<string, PatternMatch[]>()

  // Common generic sequences to ignore
  const genericSequences = new Set([
    'if() -> if()',
    'if() -> return',
    'return -> return',
    'const -> const',
    'var -> var',
  ])

  // Find sequences of 2-3 function calls
  for (let i = 0; i < lines.length - 1; i++) {
    const line1 = lines[i]
    const line2 = lines[i + 1] || ''

    // Skip comments, type definitions, and function definitions
    if (isComment(line1) || isComment(line2) ||
        isTypeDefinition(line1) || isTypeDefinition(line2) ||
        isFunctionDefinition(line1) || isFunctionDefinition(line2)) {
      continue
    }

    const trimmed1 = line1.trim()
    const trimmed2 = line2.trim()

    // Check if both are function calls
    const callPattern = /(\w+)\s*\(/
    const match1 = trimmed1.match(callPattern)
    const match2 = trimmed2.match(callPattern)

    if (match1 && match2) {
      const seq = `${match1[1]}() -> ${match2[1]}()`

      // Skip generic sequences
      if (genericSequences.has(seq)) continue

      if (!sequences.has(seq)) {
        sequences.set(seq, [])
      }
      sequences.get(seq)!.push({
        file: filePath,
        line: i + 1,
        code: `${trimmed1.substring(0, 50)}; ${trimmed2.substring(0, 50)}`,
      })
    }
  }

  for (const [seq, occurrences] of sequences.entries()) {
    // Require at least 3 occurrences
    if (occurrences.length >= 3) {
      patterns.push({
        type: 'repeated-call-sequences',
        description: `Repeated function call sequence: ${seq} (${occurrences.length} occurrences)`,
        occurrences,
        suggestion: 'Consider combining into a single helper function',
        confidence: 0.7,
      })
    }
  }

  return patterns
}

function findRepeatedErrorHandling(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const errorPatterns = new Map<string, PatternMatch[]>()

  // Find error handling patterns
  const errorKeywords = ['return null', 'return false', 'if.*return null', 'if.*return false']

  for (const keyword of errorKeywords) {
    const regex = new RegExp(keyword, 'gi')
    const found = new Map<string, PatternMatch[]>()

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip comments, type definitions, and function definitions
      if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
        continue
      }

      if (regex.test(line)) {
        // Get context (2 lines before)
        const context = lines.slice(Math.max(0, i - 2), i + 1).join('\n')
        const normalized = context
          .replace(/\s+/g, ' ')
          .replace(/\d+/g, 'N')
          .replace(/['"][^'"]+['"]/g, 'STR')
          .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')

        // Require substantial context (not just generic return null)
        if (normalized.length < 30) continue

        if (!found.has(normalized)) {
          found.set(normalized, [])
        }
        found.get(normalized)!.push({
          file: filePath,
          line: i + 1,
          code: context.substring(0, 100),
        })
      }
    }

    for (const [pattern, occurrences] of found.entries()) {
      // Require at least 2 occurrences with substantial context
      if (occurrences.length >= 2) {
        errorPatterns.set(pattern, occurrences)
      }
    }
  }

  if (errorPatterns.size > 0) {
    patterns.push({
      type: 'repeated-error-handling',
      description: 'Repeated error handling patterns',
      occurrences: Array.from(errorPatterns.values()).flat(),
      suggestion: 'Extract validation/error handling to helper',
      confidence: 0.75,
    })
  }

  return patterns
}

function findRepeatedLoopPatterns(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const loops = new Map<string, PatternMatch[]>()

  // Find while/for loops
  const loopPattern = /(?:while|for)\s*\([^)]+\)\s*\{/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip comments, type definitions, and function definitions
    if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
      continue
    }

    if (loopPattern.test(line)) {
      // Extract loop body (up to 10 lines)
      const body = lines.slice(i, Math.min(i + 10, lines.length)).join('\n')
      const normalized = body
        .replace(/\s+/g, ' ')
        .replace(/\d+/g, 'N')
        .replace(/['"][^'"]+['"]/g, 'STR')
        .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')
        .substring(0, 200)

      // Require substantial loop body (not just generic loops)
      if (normalized.length < 40) continue

      if (!loops.has(normalized)) {
        loops.set(normalized, [])
      }
      loops.get(normalized)!.push({
        file: filePath,
        line: i + 1,
        code: body.substring(0, 150),
      })
    }
  }

  for (const [pattern, occurrences] of loops.entries()) {
    // Require at least 2 occurrences
    if (occurrences.length >= 2) {
      patterns.push({
        type: 'repeated-loops',
        description: `Repeated loop patterns (${occurrences.length} occurrences)`,
        occurrences,
        suggestion: 'Extract loop logic to helper function',
        confidence: 0.65,
      })
    }
  }

  return patterns
}

function findRepeatedObjectAccessPatterns(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const accesses = new Map<string, PatternMatch[]>()

  // Common object access patterns to ignore (too generic)
  const genericPatterns = new Set(['length', 'push', 'pop', 'slice', 'substring', 'trim'])

  // Find repeated object property access patterns
  const accessPattern = /(\w+)\.(\w+)(?:\.(\w+))?/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip comments, type definitions, and function definitions
    if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
      continue
    }

    let match: RegExpExecArray | null
    while ((match = accessPattern.exec(line)) !== null) {
      const prop = match[2]
      const nested = match[3]
      const pattern = prop + (nested ? `.${nested}` : '')

      // Skip generic patterns
      if (genericPatterns.has(prop) && !nested) continue

      if (!accesses.has(pattern)) {
        accesses.set(pattern, [])
      }
      accesses.get(pattern)!.push({
        file: filePath,
        line: i + 1,
        code: line.trim().substring(0, 80),
      })
    }
  }

  for (const [pattern, occurrences] of accesses.entries()) {
    // Require at least 5 occurrences
    if (occurrences.length >= 5) {
      patterns.push({
        type: 'repeated-object-access',
        description: `Repeated object access: .${pattern} (${occurrences.length} occurrences)`,
        occurrences,
        suggestion: 'Consider destructuring or helper function',
        confidence: 0.6,
      })
    }
  }

  return patterns
}

function findRepeatedTypeChecks(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const checks = new Map<string, PatternMatch[]>()

  // Find type checking patterns
  const typeCheckPatterns = [
    /typeof\s+\w+\s*===\s*['"]/g,
    /instanceof\s+\w+/g,
    /Array\.isArray\(/g,
    /\.length\s*[><=!]+\s*\d+/g,
  ]

  for (const regex of typeCheckPatterns) {
    let match: RegExpExecArray | null
    const found = new Map<string, PatternMatch[]>()

    while ((match = regex.exec(source)) !== null) {
      const lineNum = source.substring(0, match.index).split('\n').length
      const line = lines[lineNum - 1] || ''

      // Filter out function definitions, comments, and type definitions
      if (isFunctionDefinition(line) || isComment(line) || isTypeDefinition(line)) {
        continue
      }

      const normalized = match[0].replace(/\d+/g, 'N').replace(/['"][^'"]+['"]/g, 'STR')

      if (!found.has(normalized)) {
        found.set(normalized, [])
      }
      found.get(normalized)!.push({
        file: filePath,
        line: lineNum,
        code: line.trim(),
      })
    }

    for (const [pattern, occurrences] of found.entries()) {
      // Require at least 3 occurrences
      if (occurrences.length >= 3) {
        checks.set(pattern, occurrences)
      }
    }
  }

  if (checks.size > 0) {
    patterns.push({
      type: 'repeated-type-checks',
      description: 'Repeated type checking patterns',
      occurrences: Array.from(checks.values()).flat(),
      suggestion: 'Create type guard helper functions',
      confidence: 0.7,
    })
  }

  return patterns
}

function findRepeatedCalculations(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const calculations = new Map<string, PatternMatch[]>()

  // Find mathematical/calculation patterns
  const calcPatterns = [
    /\w+\s*[+\-*/]\s*\w+\s*[+\-*/]/g, // Multiple operations
    /Math\.(min|max|abs|floor|ceil)\(/g,
    /\w+\s*\?\s*\d+\s*:\s*\d+/g, // Ternary with numbers
  ]

  for (const regex of calcPatterns) {
    let match: RegExpExecArray | null
    const found = new Map<string, PatternMatch[]>()

    while ((match = regex.exec(source)) !== null) {
      const lineNum = source.substring(0, match.index).split('\n').length
      const line = lines[lineNum - 1] || ''

      // Skip comments, type definitions, and function definitions
      if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
        continue
      }

      const normalized = match[0].replace(/\d+/g, 'N').replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')

      // Require substantial patterns (not just simple arithmetic)
      if (normalized.length < 10) continue

      if (!found.has(normalized)) {
        found.set(normalized, [])
      }
      found.get(normalized)!.push({
        file: filePath,
        line: lineNum,
        code: line.trim(),
      })
    }

    for (const [pattern, occurrences] of found.entries()) {
      // Require at least 3 occurrences
      if (occurrences.length >= 3) {
        calculations.set(pattern, occurrences)
      }
    }
  }

  if (calculations.size > 0) {
    patterns.push({
      type: 'repeated-calculations',
      description: 'Repeated calculation patterns',
      occurrences: Array.from(calculations.values()).flat(),
      suggestion: 'Extract to helper function or constant',
      confidence: 0.65,
    })
  }

  return patterns
}

function findRepeatedValidationPatterns(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const validations = new Map<string, PatternMatch[]>()

  // Find validation patterns (bounds checking, null checks, etc.)
  const validationPatterns = [
    /if\s*\(\s*\w+\s*[><=!]+\s*\w+\.length/gi,
    /if\s*\(\s*\w+\s*[><=!]+\s*\d+/gi,
    /if\s*\(\s*!\s*\w+/gi, // Negation checks
    /if\s*\(\s*\w+\s*===\s*null/gi,
    /if\s*\(\s*\w+\s*===\s*undefined/gi,
  ]

  for (const regex of validationPatterns) {
    let match: RegExpExecArray | null
    const found = new Map<string, PatternMatch[]>()

    while ((match = regex.exec(source)) !== null) {
      const lineNum = source.substring(0, match.index).split('\n').length
      const line = lines[lineNum - 1] || ''

      // Skip comments, type definitions, and function definitions
      if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
        continue
      }

      const normalized = match[0]
        .replace(/\s+/g, ' ')
        .replace(/\d+/g, 'N')
        .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')

      // Require substantial patterns (not just generic if checks)
      if (normalized.length < 15) continue

      if (!found.has(normalized)) {
        found.set(normalized, [])
      }
      found.get(normalized)!.push({
        file: filePath,
        line: lineNum,
        code: line.trim(),
      })
    }

    for (const [pattern, occurrences] of found.entries()) {
      // Require at least 3 occurrences
      if (occurrences.length >= 3) {
        validations.set(pattern, occurrences)
      }
    }
  }

  if (validations.size > 0) {
    patterns.push({
      type: 'repeated-validation',
      description: 'Repeated validation patterns',
      occurrences: Array.from(validations.values()).flat(),
      suggestion: 'Create validation helper functions',
      confidence: 0.75,
    })
  }

  return patterns
}

function findRepeatedEarlyReturns(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const earlyReturns = new Map<string, PatternMatch[]>()

  // Find early return patterns (guard clauses)
  const earlyReturnPatterns = [
    /if\s*\([^)]+\)\s*return\s+null/g,
    /if\s*\([^)]+\)\s*return\s+false/g,
    /if\s*\([^)]+\)\s*return\s+true/g,
    /if\s*\([^)]+\)\s*return\s+undefined/g,
    /if\s*\([^)]+\)\s*continue/g,
    /if\s*\([^)]+\)\s*break/g,
  ]

  for (const regex of earlyReturnPatterns) {
    let match: RegExpExecArray | null
    const found = new Map<string, PatternMatch[]>()

    while ((match = regex.exec(source)) !== null) {
      const lineNum = source.substring(0, match.index).split('\n').length
      const line = lines[lineNum - 1] || ''

      if (isFunctionDefinition(line) || isComment(line) || isTypeDefinition(line)) {
        continue
      }

      // Get context (2 lines before and after)
      const context = lines.slice(Math.max(0, lineNum - 2), Math.min(lines.length, lineNum + 2)).join('\n')
      const normalized = context
        .replace(/\s+/g, ' ')
        .replace(/\d+/g, 'N')
        .replace(/['"][^'"]+['"]/g, 'STR')
        .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')
        .substring(0, 150)

      if (normalized.length < 30) continue

      if (!found.has(normalized)) {
        found.set(normalized, [])
      }
      found.get(normalized)!.push({
        file: filePath,
        line: lineNum,
        code: line.trim(),
      })
    }

    for (const [pattern, occurrences] of found.entries()) {
      if (occurrences.length >= 3) {
        earlyReturns.set(pattern, occurrences)
      }
    }
  }

  if (earlyReturns.size > 0) {
    patterns.push({
      type: 'repeated-early-returns',
      description: 'Repeated early return/guard clause patterns',
      occurrences: Array.from(earlyReturns.values()).flat(),
      suggestion: 'Extract guard clause logic to helper function',
      confidence: 0.75,
    })
  }

  return patterns
}

function findRepeatedRegexPatterns(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const regexPatterns = new Map<string, PatternMatch[]>()

  // Find regex literals
  const regexLiteralPattern = /[\/~]([^\/~]+)[\/~][gimuy]*/g
  const found = new Map<string, PatternMatch[]>()

  let match: RegExpExecArray | null
  while ((match = regexLiteralPattern.exec(source)) !== null) {
    const regexStr = match[0]
    const lineNum = source.substring(0, match.index).split('\n').length
    const line = lines[lineNum - 1] || ''

    if (isFunctionDefinition(line) || isComment(line) || isTypeDefinition(line)) {
      continue
    }

    // Skip very short regexes (likely false positives)
    if (regexStr.length < 5) continue

    if (!found.has(regexStr)) {
      found.set(regexStr, [])
    }
    found.get(regexStr)!.push({
      file: filePath,
      line: lineNum,
      code: line.trim().substring(0, 80),
    })
  }

  for (const [regex, occurrences] of found.entries()) {
    // Require at least 3 occurrences of the same regex
    if (occurrences.length >= 3) {
      regexPatterns.set(regex, occurrences)
    }
  }

  if (regexPatterns.size > 0) {
    patterns.push({
      type: 'repeated-regex',
      description: 'Repeated regex literal patterns (should be extracted to constants)',
      occurrences: Array.from(regexPatterns.values()).flat(),
      suggestion: 'Extract regex to constant to avoid recompilation',
      confidence: 0.9,
    })
  }

  return patterns
}

function findRepeatedSwitchPatterns(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const switches = new Map<string, PatternMatch[]>()

  // Find switch statements
  const switchPattern = /switch\s*\([^)]+\)\s*\{/
  const casePattern = /case\s+[^:]+:/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
      continue
    }

    if (switchPattern.test(line)) {
      // Extract switch body (up to 50 lines)
      const body = lines.slice(i, Math.min(i + 50, lines.length)).join('\n')
      const normalized = body
        .replace(/\s+/g, ' ')
        .replace(/\d+/g, 'N')
        .replace(/['"][^'"]+['"]/g, 'STR')
        .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')
        .substring(0, 300)

      // Require substantial switch body with multiple cases
      const caseCount = (body.match(casePattern) || []).length
      if (normalized.length < 50 || caseCount < 3) continue

      if (!switches.has(normalized)) {
        switches.set(normalized, [])
      }
      switches.get(normalized)!.push({
        file: filePath,
        line: i + 1,
        code: body.substring(0, 200),
      })
    }
  }

  for (const [pattern, occurrences] of switches.entries()) {
    if (occurrences.length >= 2) {
      patterns.push({
        type: 'repeated-switch',
        description: `Repeated switch statement patterns (${occurrences.length} occurrences)`,
        occurrences,
        suggestion: 'Extract to lookup table or helper function',
        confidence: 0.7,
      })
    }
  }

  return patterns
}

function findRepeatedArrayMethods(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const methods = new Map<string, PatternMatch[]>()

  // Find chained array methods
  const arrayMethodPatterns = [
    /\.map\([^)]+\)\.filter\([^)]+\)/g,
    /\.filter\([^)]+\)\.map\([^)]+\)/g,
    /\.map\([^)]+\)\.map\([^)]+\)/g,
    /\.filter\([^)]+\)\.filter\([^)]+\)/g,
    /\.map\([^)]+\)\.reduce\([^)]+\)/g,
  ]

  for (const regex of arrayMethodPatterns) {
    let match: RegExpExecArray | null
    const found = new Map<string, PatternMatch[]>()

    while ((match = regex.exec(source)) !== null) {
      const lineNum = source.substring(0, match.index).split('\n').length
      const line = lines[lineNum - 1] || ''

      if (isFunctionDefinition(line) || isComment(line) || isTypeDefinition(line)) {
        continue
      }

      const normalized = match[0].replace(/\d+/g, 'N').replace(/['"][^'"]+['"]/g, 'STR')

      if (!found.has(normalized)) {
        found.set(normalized, [])
      }
      found.get(normalized)!.push({
        file: filePath,
        line: lineNum,
        code: line.trim(),
      })
    }

    for (const [pattern, occurrences] of found.entries()) {
      if (occurrences.length >= 3) {
        methods.set(pattern, occurrences)
      }
    }
  }

  if (methods.size > 0) {
    patterns.push({
      type: 'repeated-array-methods',
      description: 'Repeated chained array method patterns',
      occurrences: Array.from(methods.values()).flat(),
      suggestion: 'Consider combining into single pass or extracting to helper',
      confidence: 0.7,
    })
  }

  return patterns
}

function findRepeatedPropertyChains(source: string, filePath: string): HeuristicPattern[] {
  const patterns: HeuristicPattern[] = []
  const lines = source.split('\n')
  const chains = new Map<string, PatternMatch[]>()

  // Find property access chains (3+ levels deep)
  const chainPattern = /(\w+)(\.\w+){2,}/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isComment(line) || isTypeDefinition(line) || isFunctionDefinition(line)) {
      continue
    }

    let match: RegExpExecArray | null
    while ((match = chainPattern.exec(line)) !== null) {
      const chain = match[0]
      // Extract just the property chain part (e.g., ".a.b.c")
      const propChain = chain.replace(/^\w+/, 'VAR')

      if (!chains.has(propChain)) {
        chains.set(propChain, [])
      }
      chains.get(propChain)!.push({
        file: filePath,
        line: i + 1,
        code: line.trim().substring(0, 80),
      })
    }
  }

  for (const [chain, occurrences] of chains.entries()) {
    // Require at least 5 occurrences
    if (occurrences.length >= 5) {
      patterns.push({
        type: 'repeated-property-chains',
        description: `Repeated property access chain: ${chain} (${occurrences.length} occurrences)`,
        occurrences,
        suggestion: 'Consider destructuring or intermediate variable',
        confidence: 0.65,
      })
    }
  }

  return patterns
}

// Main analysis function
function analyzeFile(filePath: string, options: {
  duplicates: boolean
  helpers: boolean
  unused: boolean
  similar: boolean
  heuristics: boolean
}) {
  const source = readSourceFile(filePath)
  const results: {
    duplicates?: DuplicatePattern[]
    helpers?: HelperOpportunity[]
    unused?: FunctionUsage[]
    similar?: PatternMatch[]
    heuristics?: HeuristicPattern[]
  } = {}

  if (options.duplicates) {
    results.duplicates = findDuplicatePatterns(source, filePath)
  }

  if (options.helpers) {
    results.helpers = findHelperOpportunities(source, filePath)
  }

  if (options.unused) {
    results.unused = analyzeFunctionUsage(source, filePath).filter(f => f.canInline)
  }

  if (options.similar) {
    results.similar = findSimilarBlocks(source, filePath)
  }

  if (options.heuristics) {
    const heuristicResults = [
      ...findRepeatedConditionalPatterns(source, filePath),
      ...findRepeatedStringOperations(source, filePath),
      ...findRepeatedVariablePatterns(source, filePath),
      ...findRepeatedFunctionCallSequences(source, filePath),
      ...findRepeatedErrorHandling(source, filePath),
      ...findRepeatedLoopPatterns(source, filePath),
      ...findRepeatedObjectAccessPatterns(source, filePath),
      ...findRepeatedTypeChecks(source, filePath),
      ...findRepeatedCalculations(source, filePath),
      ...findRepeatedValidationPatterns(source, filePath),
      ...findRepeatedEarlyReturns(source, filePath),
      ...findRepeatedRegexPatterns(source, filePath),
      ...findRepeatedSwitchPatterns(source, filePath),
      ...findRepeatedArrayMethods(source, filePath),
      ...findRepeatedPropertyChains(source, filePath),
    ]
    results.heuristics = heuristicResults
  }

  return results
}

// Format and print results
function printResults(results: ReturnType<typeof analyzeFile>, filePath: string) {
  console.log(`\n📊 Analysis results for ${path.basename(filePath)}\n`)
  console.log('═'.repeat(80))

  if (results.duplicates && results.duplicates.length > 0) {
    console.log('\n🔁 DUPLICATE PATTERNS:')
    console.log('─'.repeat(80))
    for (const dup of results.duplicates.slice(0, 10)) {
      console.log(`\nFound ${dup.occurrences.length} occurrences:`)
      for (const occ of dup.occurrences.slice(0, 3)) {
        console.log(`  Line ${occ.line}: ${occ.code.substring(0, 60)}...`)
      }
    }
  }

  if (results.helpers && results.helpers.length > 0) {
    console.log('\n🛠️  HELPER OPPORTUNITIES:')
    console.log('─'.repeat(80))
    for (const opp of results.helpers) {
      console.log(`\n${opp.pattern}: ${opp.occurrences.length} occurrences`)
      console.log(`  Suggestion: ${opp.suggestedHelper}`)
      console.log(`  Estimated savings: ~${opp.estimatedSavings} bytes`)
      for (const occ of opp.occurrences.slice(0, 3)) {
        console.log(`    Line ${occ.line}: ${occ.code}`)
      }
    }
  }

  if (results.unused && results.unused.length > 0) {
    console.log('\n📦 FUNCTIONS USED ONLY ONCE (candidate for inlining):')
    console.log('─'.repeat(80))
    for (const func of results.unused.slice(0, 20)) {
      console.log(`  ${func.name} (defined at line ${func.definition.line}, used at line ${func.usages[0]?.line})`)
    }
  }

  if (results.similar && results.similar.length > 0) {
    console.log('\n🔀 SIMILAR CODE BLOCKS:')
    console.log('─'.repeat(80))
    for (const sim of results.similar.slice(0, 10)) {
      console.log(`  Line ${sim.line}: ${sim.code.substring(0, 100)}...`)
    }
  }

  if (results.heuristics && results.heuristics.length > 0) {
    console.log('\n🧠 HEURISTIC PATTERNS:')
    console.log('─'.repeat(80))

    // Group by type
    const byType = new Map<string, HeuristicPattern[]>()
    for (const h of results.heuristics) {
      if (!byType.has(h.type)) {
        byType.set(h.type, [])
      }
      byType.get(h.type)!.push(h)
    }

    for (const [type, patterns] of byType.entries()) {
      console.log(`\n${type.toUpperCase().replace(/-/g, ' ')}:`)
      for (const pattern of patterns.slice(0, 5)) {
        console.log(`  ${pattern.description} (${pattern.occurrences.length} occurrences, confidence: ${(pattern.confidence * 100).toFixed(0)}%)`)
        console.log(`    Suggestion: ${pattern.suggestion}`)
        for (const occ of pattern.occurrences.slice(0, 2)) {
          console.log(`      Line ${occ.line}: ${occ.code.substring(0, 70)}`)
        }
      }
    }
  }

  // Summary
  const totalDups = results.duplicates?.length || 0
  const totalHelpers = results.helpers?.length || 0
  const totalUnused = results.unused?.length || 0
  const totalSimilar = results.similar?.length || 0
  const totalHeuristics = results.heuristics?.length || 0

  if (totalDups + totalHelpers + totalUnused + totalSimilar + totalHeuristics === 0) {
    console.log('\n✅ No obvious patterns found!')
  } else {
    console.log('\n📈 SUMMARY:')
    console.log(`  Duplicate patterns: ${totalDups}`)
    console.log(`  Helper opportunities: ${totalHelpers}`)
    console.log(`  Single-use functions: ${totalUnused}`)
    console.log(`  Similar blocks: ${totalSimilar}`)
    console.log(`  Heuristic patterns: ${totalHeuristics}`)
  }
}

// Main
async function main() {
  const args = process.argv.slice(2)
  const all = args.includes('--all') || args.length === 0
  const options = {
    duplicates: all || args.includes('--duplicates'),
    helpers: all || args.includes('--helpers'),
    unused: all || args.includes('--unused'),
    similar: args.includes('--similar'), // Disabled by default (slow)
    heuristics: all || args.includes('--heuristics') || args.length === 0, // Enabled by default
  }

  const parseFile = path.join(import.meta.dirname, '..', 'src', 'parse.ts')

  if (!fs.existsSync(parseFile)) {
    console.error(`File not found: ${parseFile}`)
    process.exit(1)
  }

  console.log('🔍 Analyzing code patterns...\n')

  const results = analyzeFile(parseFile, options)
  printResults(results, parseFile)
}

main().catch(console.error)

