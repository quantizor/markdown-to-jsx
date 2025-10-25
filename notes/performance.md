# Performance Analysis

**Current**: ~14ms parsing time for 27KB markdown

**Key Finding**: All attempted optimizations failed or slowed things down. V8 is already highly optimized.

## TL;DR

- Bundle size: < 8KB gzipped ✅
- Parsing: ~14ms optimal for architecture
- Bottleneck: Nested parsing loop (43% CPU time)
- GC overhead: 7% (inherent to JavaScript)

## Profile Breakdown

| Function             | Time | % of Total |
| -------------------- | ---- | ---------- |
| `nestedParse`        | 87ms | 43%        |
| `patchedRender`      | 61ms | 30%        |
| `parseCaptureInline` | 47ms | 23%        |
| GC                   | 14ms | 7%         |
| `createElement`      | 26ms | 13%        |

## Failed Optimizations

Every attempt made things slower:

| Attempt                      | Result     | Reason                      |
| ---------------------------- | ---------- | --------------------------- |
| Character dispatch table     | +5% slower | Merge overhead              |
| Cursor-based parsing         | Slower     | Still needs `slice()`       |
| Array buffer for prevCapture | +6% slower | Flush overhead              |
| Block rule skip              | +3% slower | Check overhead              |
| Cache regex lookback         | No change  | Cache overhead = regex time |
| Pre-qualify all rules        | +3% slower | Double iteration            |

**Pattern**: V8 optimizes these patterns better than manual optimization.

## Architecture Constraints

1. **Priority-based rules**: Must check all rules in order
2. **Recursive parsing**: Needs incremental state updates
3. **String immutability**: Every `substring()` creates new string
4. **Regex API**: Requires actual strings, can't use cursors
5. **State mutations**: Rules mutate shared state

## Why We Can't Optimize Like markdown-it

**markdown-it**: Parse → lightweight tokens → optimize → render to HTML
**Our approach**: Parse → AST → render to React elements

**The technical constraint**: Our AST nodes include React-specific type information (`HTMLTags`, `React.JSX.IntrinsicAttributes`) embedded in the structure. This couples the AST to React, making it harder to apply optimization passes that work on neutral data structures.

**Could we use neutral tokens?** Yes, we could refactor to output lightweight tokens first (like markdown-it), then transform them. This would enable:

- AST optimization passes
- Separate parsing from rendering concerns
- Better performance profiling and caching

**The trade-off**: Larger refactor required, but would open up optimization opportunities currently unavailable.

## Conclusion

**Current state**: ~14ms is optimal for this architecture.

**To achieve 3ms would require**:

- Complete architectural rewrite
- Breaking API changes
- Months of work

**Trade-off**: Single-pass approach prioritizes bundle size and API simplicity over parsing speed.

**Recommendation**: Focus on bundle size (< 8KB ✅), API usability, and correctness over micro-optimizations.

## Profiling Tools

```bash
yarn profile    # Generate CPU profile
yarn metrics    # Show parse time, memory, GC stats
```

View profiles in Speedscope or Chrome DevTools Performance tab.
