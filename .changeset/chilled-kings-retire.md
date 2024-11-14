---
'markdown-to-jsx': patch
---

Fenced code blocks are now tolerant to a missing closing sequence; this improves use in LLM scenarios where the code block markdown is being streamed into the editor in chunks.
