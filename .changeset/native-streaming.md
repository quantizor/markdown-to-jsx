---
"markdown-to-jsx": minor
---

The `optimizeForStreaming` option now works in the React Native renderer. Previously it was ignored on native, so incomplete markdown flashed raw syntax between tokens; it now suppresses partial structures the same way the web renderers do, which makes streaming LLM responses read smoothly.
