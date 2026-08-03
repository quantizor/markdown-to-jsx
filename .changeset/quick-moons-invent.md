---
"markdown-to-jsx": patch
---

Markdown with long runs of brackets or footnote markers now parses in linear time instead of slowing to a crawl. Inputs such as thousands of repeated `[` or `[^` could previously take seconds to minutes, which mattered most when rendering untrusted input on a server.

Reported by smaury of Shielder, from a finding by Team Atlanta collected and verified by OSTIF.
