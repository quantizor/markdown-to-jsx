# Stack Overflow Analysis

**Issue**: Deeply nested delimiter sequences caused stack overflow in renderer

## Root Cause

Long sequences like `****************...text...****************` create deeply nested AST structures:

- 10,000 asterisks = ~5,000 `**` pairs
- Each pair creates nested `strong` nodes
- Recursive rendering hits JavaScript call stack limit (~10,000 frames)

## Solution

Implemented render depth limiting (see `RENDER_DEPTH_PROTECTION.md`):

- Track recursion depth
- Limit: 2500 levels
- Fallback: Plain text rendering
- Result: No crashes, graceful degradation

## Why Acceptable

- ✅ Parsing maintains O(n) complexity
- ✅ Extreme edge case (normal docs: < 100 chars)
- ✅ Language limitation, not algorithm issue
- ✅ Solved with depth limiting

## Testing

Before: Stack overflow at ~3000 levels
After: Graceful fallback at 2500 levels
