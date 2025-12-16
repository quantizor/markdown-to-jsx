---
'markdown-to-jsx': minor
---

Add intelligent JSX prop parsing

JSX prop values are now intelligently parsed instead of always being strings:

- **Arrays and objects** are parsed via `JSON.parse()`: `data={[1, 2, 3]}` → `attrs.data = [1, 2, 3]`
- **Booleans** are parsed: `enabled={true}` → `attrs.enabled = true`
- **Functions** are kept as strings for security: `onClick={() => ...}` → `attrs.onClick = "() => ..."`
- **Complex expressions** are kept as strings: `value={someVar}` → `attrs.value = "someVar"`

The original raw attribute string is preserved in the `rawAttrs` field.

**Benefits:**

- Type-safe access to structured data without manual parsing
- Backwards compatible - check types before using
- Secure by default - functions remain as strings

**Example:**

<!-- prettier-ignore -->
```tsx
// In markdown:
<ApiTable
  rows={[
    ['Name', 'Value'],
    ['foo', 'bar'],
  ]}
/>

// In your component:
const ApiTable = ({ rows }) => {
  // rows is already an array, no JSON.parse needed!
  return <table>...</table>
}

// For backwards compatibility:
const rows =
  typeof props.rows === 'string' ? JSON.parse(props.rows) : props.rows
```

**Security:** Functions remain as strings by default. Use `renderRule` for case-by-case handling, or see the new `evalUnserializableExpressions` option for opt-in eval (not recommended for user inputs).
