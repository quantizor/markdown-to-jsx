---
'markdown-to-jsx': minor
---

Added context providers and memoization to all major renderers for better developer experience and performance.

**React:**

- `MarkdownContext` - React context for default options
- `MarkdownProvider` - Provider component to avoid prop-drilling
- `useMemo` - 3-stage memoization (options, content, JSX)

**React Native:**

- `MarkdownContext` - React context for default options
- `MarkdownProvider` - Provider component to avoid prop-drilling
- `useMemo` - 3-stage memoization (options, content, JSX)

**Vue:**

- `MarkdownOptionsKey` - InjectionKey for provide/inject pattern
- `MarkdownProvider` - Provider component using Vue's provide
- `computed` - Reactive memoization for options, content, and JSX

**Benefits:**

1. **Avoid prop-drilling** - Set options once at the top level:

```tsx
<MarkdownProvider options={commonOptions}>
  <App>
    <Markdown>...</Markdown>
    <Markdown>...</Markdown>
  </App>
</MarkdownProvider>
```

2. **Performance optimization** - Content is only parsed when it actually changes, not on every render

3. **Fully backwards compatible** - Existing usage works unchanged, providers are optional

**Example:**

```tsx
import { MarkdownProvider } from 'markdown-to-jsx/react'

function App() {
  return (
    <MarkdownProvider options={{ wrapper: 'article', tagfilter: true }}>
      <Markdown># Page 1</Markdown>
      <Markdown># Page 2</Markdown>
      {/* Both inherit options from provider */}
    </MarkdownProvider>
  )
}
```
