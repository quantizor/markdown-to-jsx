---
'markdown-to-jsx': minor
---

Heading ids are generated from each heading's plain text content instead of its raw markdown source. Link destinations, formatting markers, and image alt text no longer leak into the id (for example `## [text](https://e.com)` becomes `id="text"` rather than `id="texthttpsecom"`). Anchors on headings that contained links, images, or autolinks may change; plain-text headings are unaffected. Duplicate-id suffixes (`foo`, `foo-1`) still apply.
