---
'markdown-to-jsx': patch
---

`optimizeForStreaming` now defers incomplete HTML the same way in every compiler, including Solid and Vue. Tag-like prefixes that have not finished arriving (`Hello <Citation`, `<!--…`) stay hidden until they complete, while ordinary less-than text (`5 < 3`) keeps rendering.
