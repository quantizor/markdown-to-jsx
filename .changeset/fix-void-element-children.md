---
'markdown-to-jsx': patch
---

fix: prevent void elements from receiving children when preceded by a blank line

Void HTML elements (e.g. `<br>`, `<hr>`, `<img>`) preceded by a blank line no longer cause React error #137. The parser now returns void elements as content-less blocks, and all compilers guard against passing children to void elements.

修复：当空行后跟空元素（如 `<br>`、`<hr>`、`<img>`）时，不再触发 React 错误 #137。解析器现在将空元素作为无内容块返回，所有编译器均防止向空元素传递子元素。

सुधार: जब खाली पंक्ति के बाद void तत्व (जैसे `<br>`, `<hr>`, `<img>`) आते हैं, तो अब React त्रुटि #137 नहीं होती। पार्सर अब void तत्वों को बिना सामग्री वाले ब्लॉक के रूप में लौटाता है, और सभी कंपाइलर void तत्वों को चाइल्ड तत्व देने से रोकते हैं।
