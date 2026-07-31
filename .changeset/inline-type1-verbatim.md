---
'markdown-to-jsx': patch
---

Single-line `<script>`, `<style>`, `<pre>`, and `<textarea>` blocks keep their text content when `tagfilter` is off, including under `forceInline`. Previously the React output could emit an empty tag and drop the body.
