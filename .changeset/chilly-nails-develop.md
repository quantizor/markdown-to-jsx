---
'markdown-to-jsx': patch
---

Cut down on unnecessary matching operations by improving qualifiers. Also improved the matching speed of paragraphs, which led to a roughly 2x boost in throughput for larger input strings.
