---
"markdown-to-jsx": patch
---

React Native no longer crashes when rendering content that mixes text with block elements or images. Previously, text placed next to a block (in a list, table cell, raw HTML block, preformatted block, or footnote) threw "Text strings must be rendered within a `<Text>` component", and an image inside a paragraph, heading, link, or emphasis threw "Unexpected view type nested under text node" on Android. Now a container follows its content: it stays a text element when everything inside is inline, and becomes a view (grouping text runs while laying images and blocks out alongside) when it holds a block. Image links remain tappable.
