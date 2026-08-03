---
"markdown-to-jsx": patch
---

Markdown with long runs of brackets or footnote markers now parses in linear time instead of slowing to a crawl. Inputs such as thousands of repeated `[` or `[^` could previously take seconds to minutes, which mattered most when rendering untrusted input on a server.

Found by [Team Atlanta](https://team-atlanta.github.io/), collected and verified by [OSTIF](https://ostif.org), reported with a fix by [smaury](https://github.com/smaury) of [Shielder](https://www.shielder.com).
