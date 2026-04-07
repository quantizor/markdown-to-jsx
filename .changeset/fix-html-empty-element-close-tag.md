---
'markdown-to-jsx': patch
---

Fix HTML compiler dropping the closing tag for empty non-void elements (e.g. `<p></p>` rendered as `<p>`, `<div></div>` rendered as `<div>`)
