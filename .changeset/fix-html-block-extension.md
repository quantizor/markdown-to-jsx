---
'markdown-to-jsx': patch
---

Fix HTML blocks with markdown content inside tables (#862) and restore CommonMark-correct behavior for HTML block content without blank lines (#860)

- Markdown lists inside HTML table cells now render as proper nested lists instead of breaking the table structure
- HTML block content on its own line without surrounding blank lines (e.g. `<div>\n*text*\n</div>`) is now preserved as literal text per CommonMark Example 189
- HTML block content surrounded by blank lines (e.g. `<div>\n\n*text*\n\n</div>`) continues to parse markdown as before (CommonMark Example 188)

修复 HTML 表格单元格内 Markdown 列表的渲染问题（#862），并恢复无空行 HTML 块内容的 CommonMark 正确行为（#860）

- HTML 表格单元格内的 Markdown 列表现在可以正确渲染为嵌套列表，而不会破坏表格结构
- 单独一行且无空行环绕的 HTML 块内容（例如 `<div>\n*text*\n</div>`）现在按 CommonMark 示例 189 保留为字面文本
- 空行环绕的 HTML 块内容（例如 `<div>\n\n*text*\n\n</div>`）继续按之前方式解析 Markdown（CommonMark 示例 188）

HTML तालिका कोशिकाओं के अंदर Markdown सूचियों को ठीक किया (#862) और बिना रिक्त लाइनों वाली HTML ब्लॉक सामग्री के लिए CommonMark-सही व्यवहार बहाल किया (#860)

- HTML तालिका कोशिकाओं के अंदर Markdown सूचियाँ अब तालिका संरचना को तोड़े बिना उचित नेस्टेड सूचियों के रूप में प्रस्तुत होती हैं
- अपनी पंक्ति पर बिना आसपास की रिक्त लाइनों के HTML ब्लॉक सामग्री (उदाहरण `<div>\n*text*\n</div>`) अब CommonMark उदाहरण 189 के अनुसार शाब्दिक पाठ के रूप में संरक्षित है
- रिक्त लाइनों से घिरी HTML ब्लॉक सामग्री (उदाहरण `<div>\n\n*text*\n\n</div>`) पहले की तरह Markdown को पार्स करना जारी रखती है (CommonMark उदाहरण 188)
