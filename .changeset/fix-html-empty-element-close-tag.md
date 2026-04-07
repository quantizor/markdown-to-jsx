---
'markdown-to-jsx': patch
---

Fix HTML compiler dropping the closing tag for empty non-void elements (e.g. `<p></p>` rendered as `<p>`, `<div></div>` rendered as `<div>`)

修复 HTML 编译器对空的非自闭合元素丢弃结束标签的问题（例如 `<p></p>` 渲染为 `<p>`，`<div></div>` 渲染为 `<div>`）

खाली non-void HTML तत्वों के लिए HTML कंपाइलर द्वारा क्लोजिंग टैग हटाने की समस्या ठीक की गई (उदाहरण `<p></p>` को `<p>` के रूप में और `<div></div>` को `<div>` के रूप में प्रस्तुत किया जा रहा था)
