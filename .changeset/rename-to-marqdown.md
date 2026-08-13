---
"marqdown": patch
---

`markdown-to-jsx` is now published as `marqdown`. The parser, every renderer entry point, the options, and the output are unchanged; only the package name is different. To move over, install `marqdown` and update your imports (`marqdown`, `marqdown/react`, `marqdown/vue`, and the other renderer entry points). The `markdown-to-jsx` package remains available as a compatibility alias that re-exports `marqdown`, deep imports included, so existing installs keep working and migrating stays optional.
