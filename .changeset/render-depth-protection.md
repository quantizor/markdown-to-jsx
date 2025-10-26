---
'markdown-to-jsx': patch
---

Fix renderer crash on extremely deeply nested markdown content

Previously, rendering markdown with extremely deeply nested content (e.g., thousands of nested bold markers like `****************...text...****************`) would cause a stack overflow crash. The renderer now gracefully handles such edge cases by falling back to plain text rendering instead of crashing.

**Technical details:**

- Added render depth tracking to prevent stack overflow
- Graceful fallback at 2500 levels of nesting (way beyond normal usage)
- Try/catch safety net as additional protection for unexpected errors
- Zero performance impact during normal operation
- Prevents crashes while maintaining O(n) parsing complexity

This fix ensures stability even with adversarial or malformed inputs while having no impact on normal markdown documents.
