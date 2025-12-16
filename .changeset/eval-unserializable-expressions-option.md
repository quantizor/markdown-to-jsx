---
'markdown-to-jsx': minor
---

Added opt-in `options.evalUnserializableExpressions` to eval function expressions and other unserializable JSX props from trusted markdown sources.

**⚠️ SECURITY WARNING: STRONGLY DISCOURAGED FOR USER INPUTS**

This option uses `eval()` and should ONLY be used with completely trusted markdown sources (e.g., your own documentation). Never enable this for user-submitted content.

**Usage:**

```tsx
// For trusted sources only
const markdown = `
<Button onPress={() => alert('clicked!')} />
<ApiEndpoint url={process.env.API_URL} />
`

parser(markdown, { evalUnserializableExpressions: true })

// Components receive:
// - onPress: actual function () => alert('clicked!')
// - url: the value of process.env.API_URL from your environment
// Without this option, these would be strings "() => alert('clicked!')" and "process.env.API_URL"
```

**Safer alternative:** Use `renderRule` to handle stringified expressions on a case-by-case basis with your own validation and allowlists.

See the README for detailed security considerations and safe alternatives.
