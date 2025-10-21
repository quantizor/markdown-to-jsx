---
"markdown-to-jsx": patch
---

Fix null children crashing app in production

When `null` is passed as children to the `<Markdown>` component, it would previously crash the app in production. This fix handles this case by converting it to empty string.

### Usage Example

Before this fix, the following code would crash in production:

```jsx
<Markdown>{null}</Markdown>
```

After this fix, this case is handled gracefully and renders nothing.
