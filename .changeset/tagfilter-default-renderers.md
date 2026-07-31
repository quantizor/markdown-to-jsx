---
'markdown-to-jsx': patch
---

Dangerous HTML tags (`<script>`, `<iframe>`, `<style>`, and similar) are escaped by default across the React, HTML, Solid, Vue, and React Native outputs. Matching GFM, only each tag's leading `<` is neutralized; the body and closing tag stay visible as inert text instead of being dropped. Solid, Vue, and React Native previously rendered these tags live unless `tagfilter: true` was passed explicitly, and escaped output in every renderer stopped at the opener. Direct calls to `astToJSX` follow the same default.
