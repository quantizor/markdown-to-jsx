---
"markdown-to-jsx": major
---

Remove `namedCodesToUnicode` option. All named HTML entities are now supported by default via the full entity list (`NAMED_CODES_TO_UNICODE`), so custom entity mappings are no longer needed.

**Migration:**

If you were using `namedCodesToUnicode` to add custom entity mappings, you can remove the option entirely as all standard HTML entities are now supported automatically.

```tsx
// Before
<Markdown options={{ namedCodesToUnicode: { le: '\u2264' } }}>
  &le; symbol
</Markdown>

// After
<Markdown>
  &le; symbol
</Markdown>
```

