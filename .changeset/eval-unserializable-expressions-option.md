---
'markdown-to-jsx': minor
---

Add evalUnserializableExpressions option for trusted content

Added opt-in `evalUnserializableExpressions` option to eval function expressions and other unserializable JSX props from trusted markdown sources.

**⚠️ SECURITY WARNING: STRONGLY DISCOURAGED FOR USER INPUTS**

This option uses `eval()` and should ONLY be used with completely trusted markdown sources (e.g., your own documentation). Never enable this for user-submitted content.

**Usage:**

```tsx
// For trusted sources only
parser(trustedMarkdown, { evalUnserializableExpressions: true })
```

**Safer alternative:** Use `renderRule` to handle stringified expressions on a case-by-case basis with your own validation and allowlists.

See the README for detailed security considerations and safe alternatives.
