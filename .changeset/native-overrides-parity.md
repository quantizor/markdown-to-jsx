---
'markdown-to-jsx': minor
---

React Native: `overrides` now work the same as on web. Pass an override for `code`, `pre`, `strong`, `em`, `del`, `blockquote`, `hr`, `h1`–`h6`, `ul`, `ol`, `li`, or `input` and it fires for parsed markdown — no more silent no-ops on inline emphasis, fenced code, headings, lists, or GFM task checkboxes. The `styles` prop is also tightened: each key is narrowed to the style type its component actually accepts (`TextStyle`, `ViewStyle`, or `ImageStyle`), so passing an `ImageStyle` to `paragraph` is now a compile-time error. The `Markdown` component additionally accepts `string[]` children to absorb the common JSX case where children arrive as a coalesced array.
