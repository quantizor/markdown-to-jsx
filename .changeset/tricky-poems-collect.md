---
'markdown-to-jsx': minor
---

Allow modifying HTML attribute sanitization when `options.sanitizer` is passed by the composer.

By default a lightweight URL sanitizer function is provided to avoid common attack vectors that might be placed into the `href` of an anchor tag, for example. The sanitizer receives the input, the HTML tag being targeted, and the attribute name. The original function is available as a library export called `sanitizer`.

This can be overridden and replaced with a custom sanitizer if desired via `options.sanitizer`:

```jsx
// sanitizer in this situation would receive:
// ('javascript:alert("foo")', 'a', 'href')

;<Markdown options={{ sanitizer: (value, tag, attribute) => value }}>
  {`[foo](javascript:alert("foo"))`}
</Markdown>

// or

compiler('[foo](javascript:alert("foo"))', {
  sanitizer: (value, tag, attribute) => value,
})
```
