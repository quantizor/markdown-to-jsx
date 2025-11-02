---
'markdown-to-jsx': major
---

Refactor: Major internal restructuring and performance optimizations

This branch includes significant internal improvements:

- **Code Organization**: Restructured codebase by moving all source files into `src/` directory for better organization
- **Parser Refactoring**: Split inline formatting matching logic from `match.ts` into separate `parse.ts` and `types.ts` modules
- **Performance Optimizations**: Multiple performance improvements including:
  - Optimized character lookup functions using Sets instead of arrays
  - Eliminated state object cloning in parseMarkdown
  - Optimized string concatenation in loops for large documents
  - Reduced string slicing operations in link and image parsing
  - Added early-exit optimizations for parser dispatch
  - Optimized HTML entity processing by skipping regex when no `&` present
  - Consolidated duplicate URL parsing logic
- **Code Quality**: Improved void element detection and fixed malformed HTML handling
- **Constants**: Deduplicated shared constants and utilities across modules

All changes are internal and maintain backward compatibility with no breaking API changes.
