---
'markdown-to-jsx': minor
---

fix: overhaul HTML block parsing to eliminate exponential backtracking

Replaced the complex nested regex `HTML_BLOCK_ELEMENT_R` with an efficient iterative depth-counting algorithm that maintains O(n) complexity. The new implementation uses stateful regex matching with `lastIndex` to avoid exponential backtracking on nested HTML elements while preserving all existing functionality.

**Performance improvements:**

- Eliminates O(2^n) worst-case exponential backtracking
- Linear O(n) time complexity regardless of nesting depth
