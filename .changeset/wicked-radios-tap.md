---
'markdown-to-jsx': minor
---

Add `options.disableAutoLink` to customize bare URL handling behavior.

By default, bare URLs in the markdown document will be converted into an anchor tag. This behavior can be disabled if desired.

```jsx
<Markdown options={{ disableAutoLink: true }}>
  The URL https://quantizor.dev will not be rendered as an anchor tag.
</Markdown>

// or

compiler(
  'The URL https://quantizor.dev will not be rendered as an anchor tag.',
  { disableAutoLink: true }
)

// renders:

<span>
  The URL https://quantizor.dev will not be rendered as an anchor tag.
</span>
```
