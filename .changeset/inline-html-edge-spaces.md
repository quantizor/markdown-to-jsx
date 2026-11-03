---
"markdown-to-jsx": patch
---

Inline HTML now keeps the spaces just inside its tags. `a<span> b </span>c` and `<b>bold </b>next` render with the spaces as written instead of running the words together, and an element holding only a space, such as `<span> </span>`, keeps it. This applies to every output format, with or without `optimizeForStreaming`.
