<!-- 0add7b9e-e76a-4e0f-b376-a160724ad8be cdfc62db-8491-4e67-94a6-6f9e0d2ee119 -->
# Parsing Primitives Refactor Plan

## Overview

Refactor `src/parse.ts` (14,184 lines) to use reusable parsing primitives, reducing code size by ~1,650-2,650 lines (12-19%). Implement all three phases sequentially, adding primitives to `src/utils.ts`.

## Phase 1: Low-Risk Foundations (~550-850 lines saved)

### 1.1 Parser State Object (200-300 lines saved)

**File**: `src/utils.ts`

- Add `ParserState` interface with `source`, `pos`, `end`, `start`
- Add primitives: `peek()`, `consume()`, `match()`, `expect()`, `skip()`, `skipWhitespace()`, `skipUntil()`, `findLineEnd()`, `findUnescaped()`, `findBalanced()`
- Replace repeated `let pos = start; while (pos < end)` patterns across parsers

**Files to refactor**: `src/parse.ts`

- Update `parseInlineSpan` (line 1406), `parseParagraph` (line 5486), `parseBlockQuote` (line 6482), `parseList` (line 6989), and other parsers to use `ParserState`

### 1.2 Line Iterator Abstraction (150-250 lines saved)

**File**: `src/utils.ts`

- Add `lines()` generator function that yields `{ start, end, content, indent }`
- Add `parseLineBased()` helper for line-based parsing
- Replace repeated line-scanning loops in `parseParagraph`, `parseBlockQuote`, `parseList`

### 1.3 Expanded Dispatch Table (200-300 lines saved)

**File**: `src/parse.ts`

- Expand existing dispatch table pattern (line 4907) to cover all block parsers
- Create `BLOCK_PARSERS` Map with character-to-parser mappings
- Replace verbose if/else chains in `parseMarkdown` (line 13470) with `tryParsers()` loop
- Consolidate ~700 lines of dispatch logic to ~100 lines

## Phase 2: Medium-Risk Continuation & Matching (~800-1200 lines saved)

### 2.1 Unified Continuation Checker (300-500 lines saved)

**File**: `src/utils.ts`

- Add `ContinuationChecker` interface with `canContinue()`, `extractMarker()`, `processContent()`
- Add `parseWithContinuation()` helper
- Create common checkers: `paragraphContinuation`, `blockquoteContinuation`, `listContinuation`
- Extract shared continuation logic from `parseParagraph` (lines 5486-5923), `parseBlockQuote` (lines 6482-6919), `parseList` (lines 6989-9121)

### 2.2 Balanced Bracket Matcher (200-300 lines saved)

**File**: `src/utils.ts`

- Add `findBalancedBrackets()` function with options for escapes, nested patterns, skip patterns
- Replace complex nested bracket tracking in `parseRefLink` (lines 4209-4721)
- Simplify link/image parsing logic

### 2.3 Text Accumulator Pattern (100-200 lines saved)

**File**: `src/utils.ts`

- Add `TextAccumulator` class with `flush()`, `accumulate()`, `flushIfNeeded()` methods
- Replace `flushText` pattern in `parseInlineSpan` (lines 1422-1497)
- Abstract text processing with entity decoding

## Phase 3: High-Impact Combinators (~500-800 lines saved)

### 3.1 Parser Combinator Pattern (500-800 lines saved)

**File**: `src/utils.ts`

- Add `Parser<T>` type alias
- Implement combinators: `tryP()`, `optional()`, `many()`, `seq()`, `map()`, `choice()`, `lookahead()`, `notFollowedBy()`
- Add character parsers: `char()`, `chars()`, `string()`, `regexp()`
- Refactor `parseMarkdown` dispatch logic to use combinators
- Reduce `parseMarkdown` from ~700 lines to ~100 lines

## Implementation Strategy

1. **Test-driven refactoring**: Run test suite after each phase
2. **Incremental migration**: Update parsers one at a time, starting with simpler ones
3. **Maintain compatibility**: Ensure all existing tests pass
4. **Performance**: Verify no performance regressions (parser is hot path)

## Expected Outcomes

- **Code reduction**: ~1,650-2,650 lines (12-19% smaller)
- **Maintainability**: Common patterns extracted to reusable primitives
- **Readability**: Dispatch logic simplified with combinators
- **Performance**: No degradation (may improve due to better code organization)

## Files Modified

- `src/utils.ts` - Add parsing primitives (~500-800 new lines)
- `src/parse.ts` - Refactor to use primitives (net reduction ~1,650-2,650 lines)

### To-dos

- [ ] Implement ParserState interface and primitives (peek, consume, match, expect, skip, etc.) in utils.ts
- [ ] Implement lines() generator and parseLineBased() helper in utils.ts
- [ ] Expand dispatch table pattern and refactor parseMarkdown to use tryParsers()
- [ ] Migrate parseInlineSpan, parseParagraph, parseBlockQuote, parseList to use ParserState
- [ ] Implement ContinuationChecker interface and parseWithContinuation() helper
- [ ] Implement findBalancedBrackets() and refactor parseRefLink to use it
- [ ] Implement TextAccumulator class and refactor parseInlineSpan flushText pattern
- [ ] Implement Parser<T> type and combinator functions (tryP, choice, map, etc.)
- [ ] Refactor parseMarkdown dispatch logic to use parser combinators
- [ ] Run full test suite after each phase to ensure compatibility