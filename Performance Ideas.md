# Performance Optimization Ideas

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

**Complexity**: Medium - refactor concatenation points
**Expected Gain**: 10-15% reduction

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
