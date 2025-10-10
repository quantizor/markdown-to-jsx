---
'markdown-to-jsx': major
---

Refactored inline formatting parsing to eliminate ReDoS vulnerabilities and improve performance. The previous regex-based approach was susceptible to exponential backtracking on certain inputs and had several edge case bugs with nested formatting, escaped characters, and formatting inside links. The new implementation uses a custom iterative scanner that runs in O(n) time and is immune to ReDoS attacks.

This also consolidates multiple formatting rule types into a single unified rule with boolean flags, reducing code duplication and bundle size. Performance has improved measurably on simple markdown strings:

```
+--------------------------+------------------------+-----------------------+
|                          │ simple markdown string │ large markdown string |
+--------------------------+------------------------+-----------------------+
| markdown-to-jsx (next)   │ 134,498 ops/sec        │ 720 ops/sec           |
+--------------------------+------------------------+-----------------------+
| markdown-to-jsx (7.7.15) │ 106,616 ops/sec        │ 717 ops/sec           |
+--------------------------+------------------------+-----------------------+
```

**Breaking Changes:**

The following `RuleType` enum values have been removed and consolidated into a single `RuleType.textFormatted`:

- `RuleType.textBolded`
- `RuleType.textEmphasized`
- `RuleType.textMarked`
- `RuleType.textStrikethroughed`

If you're using these rule types directly (e.g., for custom AST processing or overrides), you'll need to update your code to check for `RuleType.textFormatted` instead and inspect the node's boolean flags (`bold`, `italic`, `marked`, `strikethrough`) to determine which formatting is applied.
