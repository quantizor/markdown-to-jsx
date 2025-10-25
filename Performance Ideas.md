# Performance Optimization Ideas

## Executive Summary

**Goal**: Reduce parsing time from ~14ms to 3ms (78% reduction)

**Result**: **FAILED** - No optimization achieved meaningful gains

**Key Findings**:

- GC overhead (7% of CPU time) is inherent to JavaScript's immutable strings
- Regex matching requires string allocations (can't be avoided in JS)
- All micro-optimization attempts either failed or caused regressions
- Current ~14ms parse time is reasonable for this architecture

**Conclusion**: Getting to 3ms requires a complete architectural rewrite (two-pass parsing like markdown-it), which would fundamentally change the library's design and API.

---

## Detailed Analysis

## Character Dispatch Table Attempt

### What We Tried

Implemented a character-based dispatch table to optimize rule matching in the parser. The idea was to:

1. Pre-build a map of starting characters → candidate rule indices
2. On each character position, only check rules that could possibly match based on their `_qualify` prefixes
3. Separate rules into:
   - Array-based `_qualify` rules (can dispatch by character)
   - Function-based `_qualify` rules (must check all positions)

### Implementation Details

- Built `charRuleMap`: maps each possible starting character to arrays of rule indices
- Built `noDispatchRules`: rules with function-based qualifies that need to be checked regardless
- Created Sets for O(1) lookup performance
- Iterated through all rules, checking membership in candidate sets before attempting match

### Why It Failed

The optimization added overhead without reducing iterations:

1. **Still iterating through ALL rules**: Even though we narrowed candidates, we still looped through `ruleList.length` on every character position

2. **Extra work per iteration**:

   - Two `Set.has()` lookups per rule (`candidateSet.has()` and `noDispatchRulesSet.has()`)
   - Ternary operators and boolean checks
   - Extra conditional logic

3. **No actual reduction**: For most characters, we'd still check 20-30 rules anyway, just with more overhead

4. **Priority order complexity**: Merging candidate rules with non-dispatchable rules while maintaining priority order requires either:
   - Sorting on every character (catastrophically slow)
   - Building a merged sorted list (complex and memory intensive)

### Result

**Major performance regression** - Slower than the original code because:

- O(1) Set lookups aren't free
- Extra conditionals and branching add CPU overhead
- Didn't actually reduce the number of rules being checked

### Takeaway

For a dispatch table to work, you need to iterate through ONLY the candidate rules, not all rules with membership checks. The simpler approach of iterating through all rules with a fast `_qualify` check (often just a string prefix comparison) is actually more efficient.

---

## Other Ideas to Try

### 1. State-Based Rule Filtering

**Problem**: Many rules only apply in certain states (inline vs block, inAnchor, inTable, etc.). Currently, we check all rules even when state makes most irrelevant.

**Solution**: Maintain separate rule lists for different states:

- `blockRules`: rules that only apply in block context
- `inlineRules`: rules that only apply in inline context
- `alwaysRules`: rules that apply regardless of state

**Potential Gain**: Reduce iterations from ~30 rules to ~5-10 rules per character in inline mode

**Complexity**: Medium - need to categorize rules by state, manage rule list switches

---

### 2. Fast-Path Character Checks Before Regex

**Clarification**: This is _already_ what qualifiers do! The `_qualify` check runs `startsWith()` before calling `_match`, which skips regex execution for mismatched characters.

**Current Flow**:

```javascript
if (rule._qualify && !qualifies(source, state, rule._qualify)) {
  continue  // Skips this rule entirely
}
var capture = rule._match(source, state)  // Only reached if qualify passed
```

**Potential Optimization**:

- Inline the `qualifies` check to eliminate function call overhead
- Use direct character comparison (`source[0] === char`) instead of `startsWith()` for single-character prefixes

**Potential Gain**: Small - eliminates function call overhead, but qualify checks are already fast

**Complexity**: Low - minor code change

**Reality**: Probably not worth it - `startsWith` is already optimized, and function call overhead is minimal

---

### 3. Reduce String Allocations

**Problem**: Line 900 creates a new string on every match: `source = source.substring(capture[0].length)`. For a 10KB document with ~500 matches, that's 500+ temporary string allocations causing GC pressure.

**Current**:

```javascript
while (source) {
  // ... match rules ...
  source = source.substring(capture[0].length) // NEW STRING EVERY TIME
  var parsed = rule._parse(capture, nestedParse, state)
}
```

**Impact Analysis**:

- Every regex match = 1 new string allocation
- Nested parsing passes strings to `nestedParse()` = more allocations
- String concatenation (`state.prevCapture += capture[0]`) = more allocations
- `trim()`, `replace()`, `split()` operations create even more strings

**Proposed Solution**:

Use a cursor-based approach instead of mutating strings:

```javascript
function nestedParse(source, state, startOffset = 0) {
  const sourceLength = source.length
  let cursor = startOffset

  while (cursor < sourceLength) {
    const remaining = source.slice(cursor) // Only slice when needed
    const capture = rule._match(remaining, state)
    if (capture && capture[0]) {
      cursor += capture[0].length // Just move cursor, no new string
      // Pass cursor to nested parsing
      var parsed = rule._parse(capture, nestedParse, source, cursor, state)
    }
  }
}
```

**Trade-offs**:

- ✅ Eliminates substring allocations in main loop
- ✅ Passes indices instead of strings between functions
- ❌ Need to update ALL regex matching (they expect strings)
- ❌ Need to update `qualifies()` to work with offsets
- ❌ Need to track when actual slice is needed vs just offset

**Alternative (Incremental)**:
Keep strings but reduce allocations:

1. Use `slice()` instead of `substring()` (potentially faster)
2. Reuse string buffers where possible
3. Delay `trim()` operations until absolutely needed
4. Pass indices in addition to strings for tracking

**Potential Gain**: Significant reduction in GC pressure, smoother performance on large documents

**Complexity**: Very High - touches almost every parsing function

**Recommendation**: Profile first to quantify GC impact before attempting this refactor

**Actual Measurements** (27KB document):

- Pure Node baseline: 3,253KB
- After imports: 4,355KB
- Peak during parsing: 6,006KB
- **Parsing allocations: 1,648KB (~61x input size)**
- GC freed: 1,044KB (63% of allocations)
- Final overhead: 604KB (~22x input size)

**Conclusion**: The 1.6MB of temporary allocations from string manipulation are causing significant GC pressure. A cursor-based approach would eliminate most of these allocations.

### String Allocation Optimization Ideas

#### Idea A: Use `slice()` Instead of `substring()`

**Current**: `source = source.substring(capture[0].length)`
**Proposed**: `source = source.slice(capture[0].length)`

`slice()` might be optimized better in V8 when creating substrings from start positions.
**Complexity**: Trivial - one character change
**Expected Gain**: 5-10% reduction in allocations

---

#### Idea B: String Reuse Pool

**Problem**: Same string slices created repeatedly (e.g., whitespace, punctuation)

**Proposed**: Pool common strings:

```javascript
const stringPool = new Map()
function getStringSlice(str, start, end) {
  const key = `${start}-${end}`
  return (
    stringPool.get(key) ||
    (() => {
      const s = str.slice(start, end)
      if (s.length < 10) stringPool.set(key, s) // Only pool small strings
      return s
    })()
  )
}
```

**Trade-offs**:

- ✅ Reuses common strings
- ❌ Map overhead
- ❌ Memory leak risk if pool grows unbounded

**Complexity**: Medium
**Expected Gain**: 10-20% reduction for documents with repetitive content

---

#### Idea C: Lazy String Slicing

**Problem**: We slice `source` for every regex match, even if regex doesn't need it

**Proposed**: Only slice when regex actually matches:

```javascript
// Don't slice until we know we need it
const capture = rule._match(source, state)
if (capture && capture[0]) {
  // Only now slice the remaining source
  source = source.slice(capture[0].length)
}
```

Wait, this is already what we do! Regex.exec() works on the original string.

**Better idea**: Pre-check characters before creating any strings:

```javascript
// Check first char before any string operations
if (source.charCodeAt(0) !== expectedChar) continue
```

**Complexity**: Low
**Expected Gain**: Small - avoids some unnecessary work

---

#### Idea D: View/StringView Abstraction

**Proposed**: Create a light wrapper that represents a string slice without copying:

```javascript
class StringView {
  constructor(str, start, end) {
    this.str = str
    this.start = start
    this.end = end
  }

  slice(newStart, newEnd) {
    return new StringView(this.str, this.start + newStart, this.start + newEnd)
  }

  toString() {
    return this.str.slice(this.start, this.end)
  }

  charAt(i) {
    return this.str[this.start + i]
  }
}
```

**Trade-offs**:

- ✅ No allocations until toString() called
- ❌ Can't pass to regex.exec() (needs real string)
- ❌ All code needs to work with StringView

**Complexity**: Very High - almost as invasive as cursor approach
**Expected Gain**: ~90% reduction in allocations, but major refactor

---

#### Idea E: Incremental slice() Optimization

**Problem**: `slice(start)` creates new string

**Proposed**: Track offset and only slice when absolutely necessary:

```javascript
let cursor = 0
while (cursor < source.length) {
  const remaining = source.slice(cursor) // Only allocate when needed
  const capture = rule._match(remaining, state)
  if (capture && capture[0]) {
    cursor += capture[0].length
    // Don't slice again until next iteration
  }
}
```

**Trade-offs**:

- ✅ Only one slice per iteration
- ❌ Still creates strings, just fewer
- ✅ Much less invasive than full cursor approach

**Complexity**: Medium - need to update loop logic
**Expected Gain**: 30-50% reduction in allocations

---

#### Idea F: Buffer/StringBuilder Pattern

**Proposed**: Collect parts in array, join once:

```javascript
// Instead of: state.prevCapture += capture[0]
const captureParts = []
captureParts.push(capture[0])
// ...
state.prevCapture = captureParts.join('')
```

**Trade-offs**:

- ✅ One allocation instead of many
- ❌ Array overhead
- ❌ Extra joins
- ❌ **Doesn't work with recursive parsing**

**Complexity**: Medium - refactor concatenation points
**Expected Gain**: 10-15% reduction

**Attempted**: Failed because nested parsing relies on incremental updates to `state.prevCapture`. The buffer approach doesn't update the state during nested parsing, breaking lookback functionality used by list items and other nested rules.

**Status**: ❌ Not viable due to recursive parsing requirements

---

#### Idea G: Avoid String Operations Entirely Where Possible

**Current issues**:

1. `source.trim()` creates new string (line 886)
2. `state.prevCapture += capture[0]` creates new string (line 904)
3. `unnestedParse(normalizeWhitespace(source))` creates new string (line 922)

**Proposed**:

- Track trim offset instead of trimming
- Use array for prevCapture
- Skip normalizeWhitespace if already normalized

**Complexity**: Medium
**Expected Gain**: 20-30% reduction

---

#### Idea H: Regex Modification Strategy

**Problem**: Regex.exec() returns arrays with strings

**Proposed**: Modify regexes to match from current position:

```javascript
// Instead of slicing source, use regex with offset
const regex = /your pattern/g
regex.lastIndex = cursor
const match = regex.exec(source)
cursor = regex.lastIndex
```

**Trade-offs**:

- ✅ No slice needed
- ❌ Need to update all regexes
- ❌ Some regexes use start anchor `^`

**Complexity**: High - all regexes need review
**Expected Gain**: 40-60% reduction

---

#### Idea I: String Interning for Small Strings

**Proposed**: Intern strings shorter than threshold:

```javascript
const interned = new Map()
function intern(str) {
  if (str.length > 10) return str
  return (
    interned.get(str) ||
    (() => {
      interned.set(str, str)
      return str
    })()
  )
}
```

**Trade-offs**:

- ✅ Reuses small strings
- ❌ Memory overhead of pool
- ❌ Limited benefit (most strings aren't small enough)

**Complexity**: Low
**Expected Gain**: 5-10% reduction

---

#### Idea J: Hybrid Approach - Minor Cursor Improvements

**Proposed**: Keep strings but minimize allocations:

1. Track offset for main parsing loop (Idea E)
2. Use array buffer for prevCapture (Idea F)
3. Avoid trim operations (Idea G)
4. Skip normalizeWhitespace when possible

**Complexity**: Medium
**Expected Gain**: 40-60% reduction
**Risk**: Low - incremental changes

**Recommendation**: Start with Idea J (hybrid approach)

### Cursor Implementation Results

**Implemented**: Idea E (Incremental slice() Optimization) with cursor tracking

**Changes Made**:

- Added `sourceOffset` parameter to `nestedParse`
- Track cursor offset instead of repeatedly calling `substring()`
- Only slice once per iteration: `const remaining = source.slice(cursor)`
- Pass offset to nested parsing for continuation

**Performance Impact**:

- **Parse time**: +7.7% slower (14.21ms vs 13.20ms)
- **Allocations**: +2.4% increase (1,687KB vs 1,648KB)
- **GC freed**: +10.8% more reclaimed (1,157KB vs 1,044KB)
- **Final overhead**: -12.4% reduction (529KB vs 604KB)

**Analysis**:
The cursor approach didn't reduce allocations as expected because we still call `slice()` once per iteration. However, GC efficiency improved significantly - more memory was reclaimed with better final overhead. The slight slowdown suggests the cursor approach introduces overhead that outweighs the benefits.

**Conclusion**:

- ✅ GC efficiency improved
- ✅ Final memory footprint better
- ❌ Actually slower than original
- ❌ Didn't reduce allocations

**Next Steps**: The optimization failed because we still allocate `remaining` on every iteration. To truly reduce allocations, we'd need Idea D (StringView) or Idea H (Regex modification), but those are too invasive. The current implementation is a net negative.

**Decision**: ✅ **REVERTED** - The cursor changes have been reverted back to the original `substring()` approach. The overhead introduced (function calls, offset tracking) outweighs the minimal benefits. The original approach is simpler and performs adequately.

### Lazy String Slicing Implementation Results

**Implemented**: Simple variable to avoid reassigning `source`

**Changes Made**:

- Created `remaining` variable to hold the substring
- Changed `source = source.substring()` to `remaining = remaining.substring()`
- One fewer variable reassignment

**Performance Impact**:

- **Parse time**: Identical (14.61ms vs 14.59ms, within noise)
- **Allocations**: Identical (1,675KB vs 1,672KB, within noise)
- **GC**: Identical

**Analysis**:
This was essentially a no-op. The `remaining` variable introduced no performance benefit because the original `source.substring()` was already efficient. This confirms that `substring()` operations are optimized well in V8.

**Decision**: ✅ **REVERTED** - Trivial change with no measurable benefit

### Summary of Attempts

**Character Dispatch Table**: ❌ Failed

- Added complexity without reducing iterations
- Still checked all rules, just with Set lookups
- Major performance regression

**Cursor/Offset Tracking**: ❌ Failed

- Didn't reduce allocations as expected
- Still slice once per iteration
- Introduced overhead that slowed parsing
- GC efficiency improved slightly but not worth it

**Lazy String Slicing**: ❌ Failed

- Simple variable change with no measurable impact
- Confirmed `substring()` is already well-optimized in V8
- Within statistical noise of original

**Conclusion**:
The current implementation with `substring()` is actually quite efficient. The overhead from trying to optimize string operations outweighs the benefits. String operations in modern JS engines are highly optimized, and our hand-optimization attempts are fighting against the VM rather than helping.

**Best Path Forward**:

1. Accept current memory profile as reasonable for a parser
2. Focus on algorithmic improvements (state-based filtering) rather than micro-optimizations
3. Let the JS engine handle string optimizations
4. Consider more significant refactors only if profiling shows specific bottlenecks

The profiling tool in `yarn metrics` is now available for future performance investigations.

---

## What's Left to Try

From the original ideas, here's what's still promising:

### 🎯 High Impact Options

**1. State-Based Rule Filtering** (#1)

- **Gain**: Reduce from ~30 rules to ~5-10 per check (66-83% reduction)
- **Complexity**: Medium
- **Status**: Not tried
- **Risk**: Low - just reorganizing rule lists
- **Why Promising**: Direct reduction in iterations, biggest potential win

**2. Bail-Out After Catch-All Rules** (#8)

- **Gain**: Skip remaining rules when text rule matches (common case)
- **Complexity**: Low - small logic addition
- **Status**: Not tried
- **Risk**: Very Low
- **Why Promising**: Text rule is Priority.MIN and catches everything

### 🟡 Medium Impact Options

**3. Idea F: StringBuilder for prevCapture**

- **Gain**: 10-15% reduction in concatenation allocations
- **Complexity**: Medium - refactor concatenation points
- **Status**: Not tried
- **Risk**: Low
- **Why Moderate**: Only addresses one allocation source

**4. Idea G: Skip Unnecessary Operations**

- **Gain**: 20-30% reduction (skip trim, normalize)
- **Complexity**: Medium
- **Status**: Not tried
- **Risk**: Medium - need to track normalization state
- **Why Moderate**: Touches multiple areas

### 🔴 Low Impact / High Risk

**5. Idea A: slice() vs substring()**

- **Gain**: 5-10% reduction
- **Complexity**: Trivial
- **Status**: Not tried
- **Note**: V8 likely optimized already

**6. Idea B: String Pool**

- **Gain**: 10-20% for repetitive content
- **Complexity**: Medium
- **Risk**: Memory leak potential
- **Status**: Not tried

**7. Idea D/H: Major Refactors**

- **Gain**: High
- **Complexity**: Very High
- **Risk**: Very High
- **Status**: Should avoid unless necessary

### Recommendation

Try **#1 (State-Based Rule Filtering)** first. It's the highest potential impact with reasonable complexity and low risk. This could meaningfully reduce iterations and improve cache locality.

### How to Profile Memory Pressure

#### Quick Test - Heap Usage

```javascript
// Add to parserFor function
if (process.env.DEBUG) {
  const usage = process.memoryUsage()
  console.log({
    beforeParse: {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    },
  })

  // ... parsing happens ...

  const afterUsage = process.memoryUsage()
  console.log({
    afterParse: {
      heapUsed: Math.round(afterUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(afterUsage.heapTotal / 1024 / 1024) + 'MB',
      allocated:
        Math.round((afterUsage.heapUsed - usage.heapUsed) / 1024) + 'KB',
    },
  })
}
```

#### Chrome DevTools Performance Profiler

1. Open Chrome DevTools → Performance tab
2. Record a heap snapshot before parsing
3. Parse markdown
4. Record another heap snapshot
5. Compare to see allocations
6. Look for many small String objects

#### Node.js --expose-gc Flag

```bash
node --expose-gc --trace-gc your-test.js

# Output shows:
# [GC] 1234 ms: Scavenge 2.5 MB -> 1.8 MB (15 ms)
# Look for frequent GC pauses during parsing
```

#### Chrome DevTools Memory Tab

1. Record heap snapshot
2. Look for "String" constructor
3. See how many strings are allocated
4. Focus on "shallow size" of string objects

#### Benchmark Script

```javascript
// test-allocations.js
const compiler = require('./index.tsx').compiler
const { performance } = require('perf_hooks')

const markdown = 'Your test markdown here...'

const gc = global.gc
if (gc) gc()

const t0 = performance.now()
const result = compiler(markdown)
const t1 = performance.now()

if (gc) gc()
const usage = process.memoryUsage()

console.log({
  parseTime: `${(t1 - t0).toFixed(2)}ms`,
  heapUsed: `${Math.round(usage.heapUsed / 1024)}KB`,
  heapTotal: `${Math.round(usage.heapTotal / 1024)}KB`,
})

// Run with: node --expose-gc test-allocations.js
```

#### What to Look For

- **GC pause frequency**: Frequent GCs during parsing = lots of allocations
- **Memory growth**: If heap grows much larger than input document = extra allocations
- **String count**: Count of String objects in heap snapshot
- **Parse time**: Correlation between memory pressure and slowdown

---

### 4. Character Code Pre-Checking

**Problem**: Some rules check for specific first characters but do full regex match anyway.

**Proposed**: Check first 1-2 character codes directly before running regex:

```javascript
// Instead of regex.exec() directly
const c0 = source.charCodeAt(0)
const c1 = source.charCodeAt(1)
if (c0 === 0x23 /* '#' */) {
  // Check heading
} else if (c0 === 0x3e /* '>' */) {
  // Check blockquote
}
```

**Potential Gain**: Fast integer comparisons instead of regex engine

**Complexity**: Medium - need to handle all special character cases

---

### 5. Memoization for Repeated Substrings

**Problem**: The same markdown patterns (especially inline formatting) appear repeatedly in documents.

**Proposed**: Cache parse results for identical substrings:

```javascript
const cache = new Map()
const hash = simpleHash(source.slice(0, 100))
if (cache.has(hash)) return cache.get(hash)
```

**Potential Gain**: O(1) for repeated content instead of re-parsing

**Complexity**: Medium-High - need good hash function, cache invalidation strategy, memory management

**Risk**: Memory explosion on varied content

---

### 6. Precompile Regex Patterns

**Problem**: Some regexes are created dynamically in `matchInlineFormatting()` and other functions.

**Proposed**: Pre-generate regexes for common cases during rule initialization.

**Potential Gain**: Eliminate regex construction overhead

**Complexity**: Low - mostly moving code around

---

### 7. Typed Arrays for Rule Indices

**Problem**: Using regular arrays for rule indices. Typed arrays could be faster.

**Proposed**:

```javascript
const ruleList = new Uint8Array(sortedRules.length)
```

**Potential Gain**: Faster array access, better memory locality

**Complexity**: Low - mostly type changes

**Risk**: May not help much with small arrays (~30 items)

---

### 8. Bail-Out After Certain Rules

**Problem**: `text` rule has Priority.MIN and catches everything. If it matches, we don't need to check any other rule.

**Proposed**: Track "catch-all" rules and short-circuit when they match:

```javascript
if (rule._order === Priority.MIN && capture) {
  // This rule catches everything, stop checking others
  break immediately
}
```

**Potential Gain**: Skip remaining rules when guaranteed match found

**Complexity**: Low - small logic addition

---

### 9. Batch Regex Evaluation

**Problem**: Executing regex one at a time serially.

**Proposed**: Use regex alternation to test multiple patterns at once:

```javascript
const COMBINED_R = /^(?:heading|blockquote|code)/
```

**Potential Gain**: Single regex execution instead of many

**Complexity**: High - loses fine-grained control, harder to extract captures

**Risk**: May actually be slower due to backtracking complexity

---

### 10. SIMD/Vectorization Opportunities

**Problem**: Character-by-character checks could potentially be vectorized.

**Proposed**: Use typed arrays and process multiple characters at once with bitwise operations.

**Potential Gain**: 4-8x speedup on character checks if JS engine can vectorize

**Complexity**: Very High - requires assembly-level thinking, browser optimization-dependent

**Reality**: Probably not worth it, depends on JS engine implementation

---

## Attempted Optimizations

### State-Based Rule Filtering (Inline Qualify Check)

**Implemented**: Inlined the `qualifies()` function call to eliminate function call overhead in the hot path

**Changes Made**:

- Moved the qualify check logic directly into the nestedParse loop
- Eliminated the function call to `qualifies()`
- Direct check of array-based qualifies using `startsWith()`

**Performance Impact**:

- **Parse time**: 14.66ms vs 14.35ms baseline (+2.2% slower)
- **Allocations**: 1,631KB vs 1,672KB baseline (slightly better)
- **Final overhead**: 610KB vs 529KB baseline (+15% worse)

**Analysis**:
Inlining the qualify check **hurt performance**. The added variable declarations (`qualifiesMatch`, `j`) and the more complex control flow introduced overhead that outweighed the benefit of eliminating a single function call. V8's inlining is already very good at optimizing small function calls like `qualifies()`.

**Decision**: ✅ **REVERTED** - Micro-optimization that added overhead

### State-Based Rule Filtering (Block Rule Skip)

**Implemented**: Skip block-only rules when `state.inline` is true

**Changes Made**:

- Created `BLOCK_ONLY_RULES` Set with 13 block-only rule types
- Added check `if ((state.inline || state.simple) && BLOCK_ONLY_RULES.has(ruleType)) continue`
- Skip block rules (paragraph, heading, list, etc.) when parsing inline content

**Performance Impact**:

- Failed tests due to state switching issues
- The dynamic nature of `state.inline` (switches during parsing) makes this approach fragile

**Analysis**:
State-based rule filtering is theoretically sound but practically difficult to implement correctly. The parser switches between inline and block modes dynamically, and incorrectly categorizing rules can cause parsing failures. The added Set lookup overhead may not justify the skipped rules, especially since most parsing starts in block mode.

**Decision**: ✅ **REVERTED** - Too complex and fragile for the potential gain

---

## Updated Summary of Attempts

**Character Dispatch Table**: ❌ Failed - Added complexity without reducing iterations

**Cursor/Offset Tracking**: ❌ Failed - Didn't reduce allocations, introduced overhead

**Lazy String Slicing**: ❌ Failed - No measurable impact

**Inline Qualify Check**: ❌ Failed - Micro-optimization that added overhead

**Block Rule Skip**: ❌ Failed - Too complex and fragile

**Character Dispatch Table (Proper)**: ❌ Failed - Can't maintain priority order efficiently

**Conclusion**:
The current implementation is already well-optimized within its architectural constraints. V8's JIT compiler handles micro-optimizations automatically (function inlining, string operations, etc.). Manual attempts to optimize these areas add overhead rather than benefit.

**Best Path Forward**:

1. **Accept current performance** - 14ms for 27KB is reasonable for single-pass JSX output
2. **Understand the architectural trade-off** - The 2-3x gap vs markdown-it is inherent to the design
3. **Focus on bundle size** instead of runtime performance (already < 8KB gzipped)
4. **Consider architectural changes** only if performance becomes a real user problem

**Key Realization**: The performance "problem" isn't a bug - it's a fundamental consequence of choosing single-pass direct-to-JSX architecture over two-pass tokenization. Both have merits, but optimize different things.

---

### Character Dispatch Table (Second Attempt - Proper Iteration Reduction)

**Implemented**: Proper dispatch table that ONLY iterates through candidate rules for each character

**Changes Made**:

- Built `charDispatch` mapping characters to candidate rules
- Separated non-dispatchable rules (function-based qualifiers)
- Only iterate through `candidates.concat(nonDispatchableRules)` instead of all 30 rules
- Attempted to merge lists while maintaining priority order

**Performance Impact**:

- **Parse time**: 13.57ms (with sorting every iteration) - 5.4% faster, but...
- **Correctness**: Failed tests due to priority order issues

**Analysis**:
The dispatch table CAN reduce iterations, but maintaining priority order when merging candidate and non-dispatchable rules requires:

1. Sorting every iteration (13.57ms) - wastes the gain
2. Complex merge logic - fragile and error-prone

The fundamental problem: **we need to iterate rules in priority order**. Dispatch breaks this ordering by grouping rules by character, requiring re-sorting that negates the benefit.

**Decision**: ✅ **REVERTED** - Can't maintain priority order efficiently

**Key Insight**: The current linear scan through sorted rules is actually optimal. The priority system and qualifier checks already filter most rules efficiently. Trying to be clever with dispatch tables adds overhead that outweighs benefits.

---

## Why markdown-it is Faster

### Key Architectural Differences

Based on benchmarks and architectural analysis, markdown-it achieves 2-3x better performance than markdown-to-jsx. Here's why:

#### 1. **Two-Pass Architecture**

**markdown-it**:

- **Pass 1 (Tokenization)**: Convert markdown → AST (tokens)
- **Pass 2 (Rendering)**: Convert AST → HTML

**markdown-to-jsx**:

- **Single Pass**: Directly convert markdown → JSX in one pass

**Performance Impact**:

- Tokens are lightweight objects (just type + content)
- Rendering logic only processes tokens, not raw markdown
- Regex and parsing overhead happens once, rendering is cheap
- Separation allows optimization of each phase independently

#### 2. **Token-Based Representation**

**markdown-it tokens**:

```javascript
{ type: 'paragraph_open', tag: 'p' }
{ type: 'text', content: 'hello' }
{ type: 'paragraph_close', tag: 'p' }
```

**markdown-to-jsx**:

- Directly generates JSX elements during parsing
- Each rule creates JSX structures immediately
- Mixes parsing concerns with rendering concerns

**Performance Impact**:

- Tokens are simple objects (fast to create, manipulate, cache)
- Rendering can be optimized independently (memoization, etc.)
- No React.createElement overhead during parsing

#### 3. **Optimized Tokenizer Loop**

**markdown-it**:

- Uses dedicated `StateInline` and `StateBlock` classes
- Tokenizer rules don't create HTML/JSX
- Rules return simple match objects, tokens are created separately
- Parsing is purely data extraction

**markdown-to-jsx**:

- Each rule calls `rule._parse()` which returns **data objects** (not JSX)
- Data objects are rendered to JSX in a separate phase via `render()` function
- More complex rule matching logic with qualifier checks
- JSX creation happens after parsing completes, not during parsing

**Clarification**: I was wrong about JSX creation during parsing. The flow is:

1. Parse markdown → data objects (AST-like)
2. Render data objects → JSX via `React.createElement`

So JSX overhead isn't during parsing - it's during rendering. The real bottleneck is the parsing phase itself.

#### 4. **Rule Execution Model**

**markdown-it**:

- Rules execute sequentially on token stream
- Each rule modifies tokens in-place
- Simple match → create token → continue
- No priority system needed

**markdown-to-jsx**:

- Priority-based rule system
- Each character position checks all rules in priority order
- Qualifier pre-checks add overhead
- More complex rule coordination

#### 5. **Less String Manipulation**

**markdown-it**:

- Tokenizer extracts spans from original string
- Tokens reference source positions
- Minimal string copying during parsing
- Strings only created for final HTML output

**markdown-to-jsx**:

- Constant `substring()` calls during parsing
- Each match slices the source string
- Nested parsing creates more strings
- String allocations throughout parsing

### Key Performance Bottlenecks in markdown-to-jsx

1. **Priority System**: Overhead from sorting and qualifying checks
2. **String Operations**: Too many substring allocations during parsing
3. **Recursive Complexity**: Each rule's parse can trigger full nested parsing
4. **Rule Matching Overhead**: Each character position checks multiple rules with qualifiers
5. **JSX Creation Overhead**: React.createElement calls during rendering (not parsing)

**Correction**: JSX creation happens **after** parsing, so it's not a parsing bottleneck. The real issue is the parsing algorithm itself (priority-based rule checking).

### What markdown-it Does Right

1. ✅ **Separation of concerns**: Parse once, render separately
2. ✅ **Lightweight tokens**: Simple objects, not JSX
3. ✅ **Minimal allocations**: Token references, not copies
4. ✅ **Optimized for parsing**: Single responsibility
5. ✅ **Cacheable**: Tokens can be cached, rendering is cheap

### Fundamental Architectural Constraint

**The Real Problem**: markdown-to-jsx uses a priority-based rule system that checks multiple rules per character position.

**markdown-it's advantage**:

- Rules run sequentially on tokens, not character-by-character
- Simpler execution model (match → create token → continue)
- No priority overhead
- No qualifier checks

**The actual bottlenecks**:

1. Priority-based rule checking (checking many rules per position)
2. Qualifier pre-checks before full regex
3. String manipulation (substring calls)
4. Recursive parsing calls

**Not the problem**: JSX creation (happens after parsing)

### Conclusion

The performance gap is from **fundamental architectural differences**:

1. **Rule execution model**: Sequential token parsing vs priority-based character checking
2. **Overhead**: markdown-it has simpler rule matching without qualifiers
3. **String handling**: markdown-it uses token positions, markdown-to-jsx uses substring calls
4. **Not JSX overhead**: Both parse to data first, then render (JSX overhead is the same)

**The real difference**: markdown-it's two-pass tokenization is inherently faster than character-by-character priority-based parsing.

### Potential Improvements (Without Full Rewrite)

1. ✅ **AST Exposure**: Parse to AST and expose it (IMPLEMENTED - Feature)
2. **Profile React Rendering**: Measure time spent in React.createElement
3. **Optimize Rendering**: Reduce JSX creation overhead
4. **Memoization**: Cache rendered JSX for repeated ASTs
5. ~~**String Reduction**: Use token positions instead of substring calls~~ (❌ Attempted - incompatible with recursive parsing)

### Next Steps for Performance:

**Phase 1: Measure rendering performance**

- Profile `render()` function separately
- Measure React.createElement overhead
- Determine parsing vs rendering split

**Phase 2: Optimize based on findings**

- If rendering is the bottleneck: optimize JSX creation
- If parsing is the bottleneck: focus on parsing optimizations (already done)
- If memory is the bottleneck: reduce allocations during rendering

## Parsing Performance Deep Dive

**Current State** (27KB document):

- **Parse time**: 6.12ms (67% of total)
- **Render time**: 3.02ms (33% of total)
- **Total**: 9.14ms

### Profiling Data:

**Match Attempts**: 1,282 across all rules
**Match Success**: 1,034 matches (19.3% miss ratio)
**Most Expensive Rules**:

- `htmlBlock`: 2.230ms for 30 executions (74ms avg per execution!)
- `unorderedList`: 1.282ms for 7 executions (183ms avg per execution!)
- `headingSetext`: 0.209ms max per execution

### Key Bottlenecks Identified:

1. **Nested Parsing Overhead** (`htmlBlock`, `unorderedList`)

   - Each HTML block and list item triggers full recursive parsing
   - `parse(adjustedContent, state)` calls `nestedParse` which iterates through ALL rules again
   - For nested structures, this compounds exponentially

2. **Lookback Regex** (`unorderedList`)

   - `LIST_LOOKBEHIND_R.exec(state.prevCapture)` runs on every attempt
   - Requires string scanning to find line starts

3. **String Operations** (everywhere)
   - `source.substring()` on every match (1,034 times)
   - `state.prevCapture += capture[0]` (1,034 times)
   - `replace()`, `trim()`, `includes()` calls in list parsing

### What's NOT the Bottleneck:

1. ✅ Qualifier checks - already optimized with `startsWith()`
2. ✅ Regex execution - typically < 0.003ms each
3. ✅ Rule iteration overhead - minimal (just array access)

### What IS the Bottleneck:

**Nested parsing recursion** - the biggest issue is that parsing nested content (HTML blocks, list items) triggers a complete re-scan of all rules. This is O(n × m) behavior where n is nesting depth and m is number of rules (~30).

**The Real Problem**: Every nested parse goes through the same 30-rule loop. For deeply nested content, this compounds.

**Example**: A list with 10 items, each containing paragraphs:

- Each list item parse: checks 30 rules
- Each paragraph parse: checks 30 rules
- Total: 10 × 30 (list items) + 10 × 30 (paragraphs) = 600 rule checks

### How to Make It Non-Exponential:

**Clarification**: It's not actually exponential! It's **O(n × m)** where:

- n = nesting depth
- m = number of rules (~30)

For depth 3: 3 × 30 = 90 rule checks
For depth 10: 10 × 30 = 300 rule checks

This is **linear** with nesting depth, not exponential. Exponential would be 30^depth.

**The Real Issue**: For large documents with many nested structures, this accumulates.

### Potential Solutions:

**1. Context-Aware Rule Filtering** (Most Promising)

- When parsing inline content, skip block-only rules
- Manually categorize rules once: block, inline, or both
- In `nestedParse`, use filtered rule list based on `state.inline`
- **Attempted**: Failed because manual categorization is error-prone and broke tests
- **Potential gain**: 30-50% reduction in inline parsing iterations

**2. Memoization**

- Cache parse results for identical substrings
- **Potential gain**: Near-instant for repeated content
- **Complexity**: High - need invalidation strategy
- **Risk**: Memory explosion

**3. Pass Explicit Parser Functions**

- Have separate `parseBlock` and `parseInline` functions
- Call appropriate one based on context
- **Issue**: Duplicates rule iteration logic

**4. Early Bail-Outs**

- Skip remaining rules when guaranteed match found
- **Attempted**: Failed - broke text matching logic

**Attempted**: Implemented context-aware filtering to skip block-only rules in inline mode.

- **Results**: 14.99ms (actually slower than baseline ~6ms)
- **Why failed**: Adding conditional logic inside the hot loop (`activeRules` check) creates overhead that outweighs the benefit
- **Insight**: Micro-optimizations that add conditionals to hot paths are counterproductive. The rule list is small (~29 rules), so iterating through all rules is fast.

**Conclusion**: Analyzed performance profile and found:

- **Paragraph parsing**: 2.6ms (largest cost, 131 executions)
- **HTML block parsing**: 2.2ms (30 executions)
- **Code block parsing**: 0.5ms (82 executions)
- **Text parsing**: 0.2ms (655 executions, but very fast)

Nested recursion is NOT the bottleneck. The `matchParagraph` function is slow due to:

- Multiple `includes()` calls checking for `\n\n`
- Repeated `indexOf('\n')` in a while loop
- String concatenation in the loop (`match += line`)
- `some(NON_PARAGRAPH_BLOCK_SYNTAXES, line)` called per line

To achieve 3ms parsing (~78% reduction from 14ms):

1. ✅ **Identified**: Paragraph parsing is slowest (2.6ms)
2. ✅ **Identified**: HTML block parsing is second (2.2ms)
3. ❌ **Attempted**: Optimize `matchParagraph` - broke test, too risky
4. **Alternative**: Focus on eliminating RegExp creation in HTML block `_parse`

**Reality Check**: If the total time is 14ms and rendering is ~3ms (from profiling), then parsing is ~11ms. To get to 3ms parsing would require ~73% reduction, which is unrealistic without architectural changes.

**Recommendation**: Accept the current performance. The library is well-optimized for its architecture.

### Final Analysis: Can We Get to 3ms?

**Current state**: 13.89ms parsing time for 27KB markdown
**Target**: 3ms parsing time
**Required reduction**: ~78%

**Finding**: This is not achievable with incremental optimizations. The bottlenecks are:

1. Paragraph matching algorithm is inherently O(n) per paragraph due to line-by-line checking
2. HTML block parsing requires nested parsing with regex construction
3. The parsing model itself is iterative over rules and source strings

**To reach 3ms would require**:

- Complete rewrite using a different parsing model (e.g., markdown-it's tokenizer-first approach)
- Pre-compiling all dynamic regexes
- Eliminating nested parsing recursion entirely

**Conclusion**: The current 14ms parse time is reasonable for this architecture. Further optimization would risk correctness for minimal gains.

## CPU Profiling Setup

Added `yarn profile` command to generate CPU profiles for detailed analysis.

**Usage**:

```bash
yarn profile  # Generates CPU.XXXX.cpuprofile
```

**View in Chrome DevTools**:

1. Open Chrome DevTools → Performance tab
2. Click "Load profile" button
3. Select the `.cpuprofile` file
4. Analyze the flamegraph to identify hot paths

**Findings**:

- Average parse time over 100 iterations: **1.66ms** (much faster than single run!)
- This suggests warm-up/JIT effects are significant
- The profile shows most time in regex matching and nested parsing

**Profile Analysis Results** (Sandwich view):

**Top Offenders**:

1. **`nestedParse`**: 87.33ms (43%) total, 39.83ms (20%) self - Core parsing loop
2. **`patchedRender`**: 60.63ms (30%) total, 3.75ms (1.8%) self - Rendering pipeline
3. **`parseCaptureInline`**: 46.79ms (23%) total, 11.25ms (5.5%) self - Inline parsing
4. **`h`**: 46.33ms (23%) total, 11.46ms (5.6%) self - JSX factory
5. **`createElement`**: 25.67ms (13%) total, 3.79ms (1.9%) self - React.createElement
6. **`(garbage collector)`**: **14.12ms (7.0%) total, 14.12ms (7.0%) self** ⚠️ **CRITICAL**
7. **`RegExp: ^---[ \t]*\n(.|\n)*\n---[ \t]*\n`**: 13.71ms (6.7%) total, 11.17ms (5.5%) self - Front matter regex

**Key Insight**: The garbage collector itself is consuming **7% of total CPU time**! All self-time means it's actively collecting, indicating high allocation pressure.

**GC-Friendly Optimizations** (Target: Reduce 14.12ms GC time):

**Attempted Optimizations**:

**1. Cursor-Based Substring Elimination** ❌ **FAILED**

- Tried using cursor/offset instead of `source.substring()`
- Still had to use `source.slice(cursor)` which allocates
- No performance improvement (14.81ms vs 13.89ms)

**2. Array Buffer for prevCapture** ❌ **FAILED**

- Tried using array buffer instead of `state.prevCapture += capture[0]`
- Broke recursive parsing (nested parses need incremental updates)
- Tests failed due to state management issues

**Why These Failed**:

- JavaScript strings are immutable - any operation creates new strings
- V8 already optimizes `+=` concatenation with ropes
- The GC overhead (7%) is inherent to the parsing model
- Rules need actual strings, not just offsets
- Recursive parsing needs incremental state updates

**Conclusion**: The 7% GC overhead is a fundamental cost of the markdown parsing architecture. To eliminate it would require:

1. Rewriting parser to avoid string manipulations entirely (unrealistic)
2. Using native string views (not available in JS)
3. Accepting that markdown parsing has allocation overhead

**Character Array Optimization** ❌ **FAILED - MAJOR REGRESSION**

Attempted to cache character array for fast single-character access:

- Added `_sourceArray` and `_sourceOffset` to state
- Optimized `qualifies()` to use `arr[offset]` for single-char checks
- Track offset as we parse

**Results**: Caused significant performance regression

**Why It Failed**:

- The character array split creates additional overhead
- Tracking offset adds complexity without eliminating the main bottleneck
- Single-char optimizations don't offset the cost of array operations
- The "fast path" conditionals add overhead

**Final Analysis**:

- GC overhead (7%) is inherent to JavaScript's immutable strings and regex API
- Every optimization attempt either failed or caused regressions
- The current ~14ms parse time is reasonable for the architecture
- Getting to 3ms (~78% reduction) is **not achievable** without complete architectural rewrite

### Optimization Opportunities:

1. ~~**Early termination for text rule**~~ - Attempted but broke parsing logic. Text rule needs to match character-by-character, not greedily.
2. **Cache compiled regexes** - Some rules create regexes dynamically (`LIST_ITEM_PREFIX_R`)
3. **Optimize lookback** - Maybe track line starts instead of scanning `prevCapture`

### Attempted Optimizations:

**Early Termination for Text Rule** ❌ **FAILED**

- **Idea**: When text rule matches, skip remaining rules and match text greedily
- **Implementation**: Added `if (rule._order === Priority.MIN)` check after text match
- **Result**: Broke parsing - text was matched too greedily, consuming special characters
- **Why Failed**: Text rule must match exact regex boundaries, not greedily

But realistically: **these won't give significant wins**. The fundamental O(n²) behavior of nested parsing is the constraint.

### Should We Rewrite?

**No** - The architectural change required (two-pass parsing) would break the API and potentially the design goals. The library's value proposition is "markdown → JSX in one step", which is incompatible with markdown-it's architecture.

**Current performance (14ms for 27KB) is reasonable** for a single-pass parser that outputs JSX directly. The 2-3x gap is the cost of the architectural decision, not a bug.
