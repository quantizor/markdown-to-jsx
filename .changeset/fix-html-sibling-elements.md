---
"markdown-to-jsx": patch
---

Fix HTML block parsing for sibling elements like `<dt>`/`<dd>` without blank lines between them.

Type 6 HTML blocks (such as `<dl>`, `<dt>`, `<dd>`, `<table>`, `<tr>`, `<td>`) were incorrectly parsed when sibling elements appeared without blank lines between them—the first element would consume all subsequent siblings as its content instead of treating them as separate elements.

This fix adds nesting-aware closing tag detection that properly handles:
- Nested elements with the same tag name (e.g., `<div><div></div></div>`)
- Sibling elements at the same level (e.g., `<dt></dt><dd></dd>`)
- CommonMark compliance for HTML blocks that should extend to blank lines

---

修复了没有空行分隔的兄弟 HTML 元素（如 `<dt>`/`<dd>`）的块解析问题。

类型 6 HTML 块（如 `<dl>`、`<dt>`、`<dd>`、`<table>`、`<tr>`、`<td>`）在兄弟元素之间没有空行时解析错误——第一个元素会将所有后续兄弟元素作为其内容，而不是将它们视为单独的元素。

此修复添加了具有嵌套感知的关闭标签检测，正确处理：
- 同名标签的嵌套元素（例如 `<div><div></div></div>`）
- 同级的兄弟元素（例如 `<dt></dt><dd></dd>`）
- 应延续到空行的 HTML 块的 CommonMark 合规性

---

रिक्त पंक्तियों के बिना भाई HTML तत्वों (जैसे `<dt>`/`<dd>`) के लिए HTML ब्लॉक पार्सिंग को ठीक किया।

टाइप 6 HTML ब्लॉक (जैसे `<dl>`, `<dt>`, `<dd>`, `<table>`, `<tr>`, `<td>`) गलत तरीके से पार्स हो रहे थे जब भाई तत्व बिना रिक्त पंक्तियों के दिखाई देते थे—पहला तत्व सभी अनुवर्ती भाई तत्वों को अपनी सामग्री के रूप में शामिल कर लेता था, उन्हें अलग तत्वों के रूप में मानने के बजाय।

यह सुधार नेस्टिंग-जागरूक क्लोजिंग टैग पहचान जोड़ता है जो सही ढंग से संभालता है:
- समान टैग नाम वाले नेस्टेड तत्व (उदाहरण: `<div><div></div></div>`)
- समान स्तर पर भाई तत्व (उदाहरण: `<dt></dt><dd></dd>`)
- HTML ब्लॉक के लिए CommonMark अनुपालन जो रिक्त पंक्तियों तक विस्तारित होने चाहिए
