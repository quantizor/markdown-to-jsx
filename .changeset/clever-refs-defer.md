---
'markdown-to-jsx': patch
---

Parsing is significantly faster, around 40% on large documents, with the biggest gains on link-heavy and code-heavy content. Also fixed an edge case where a reference definition split across blockquote lines could be matched by a link using the raw, unnormalized label.
