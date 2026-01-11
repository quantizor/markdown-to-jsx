---
"markdown-to-jsx": patch
---

Fix multi-line HTML tag attribute parsing (#781)

HTML tags with attributes spanning multiple lines were not having their attributes correctly parsed into the AST. This caused custom elements with multi-line `data-*` attributes to have empty `attrs` objects, and the React compiler would then duplicate the opening tag when rendering.

This fix ensures:
- Attributes are correctly parsed for type 7 HTML blocks with newlines in the opening tag
- The React compiler uses the parsed `children` array instead of re-parsing `rawText` when attributes are already parsed

***

修复多行 HTML 标签属性解析问题（#781）

具有跨多行属性的 HTML 标签没有正确将其属性解析到 AST 中。这导致具有多行 `data-*` 属性的自定义元素具有空的 `attrs` 对象，然后 React 编译器在渲染时会重复开始标签。

此修复确保：
- 对于开始标签中包含换行符的类型 7 HTML 块，属性被正确解析
- 当属性已被解析时，React 编译器使用已解析的 `children` 数组而不是重新解析 `rawText`

***

बहु-पंक्ति HTML टैग विशेषता पार्सिंग ठीक करें (#781)

कई पंक्तियों में फैले विशेषताओं वाले HTML टैग अपनी विशेषताओं को AST में सही ढंग से पार्स नहीं कर रहे थे। इससे बहु-पंक्ति `data-*` विशेषताओं वाले कस्टम तत्वों में खाली `attrs` ऑब्जेक्ट थे, और फिर React कंपाइलर रेंडरिंग करते समय आरंभिक टैग को दोहरा देता था।

यह सुधार सुनिश्चित करता है:
- आरंभिक टैग में न्यूलाइन वाले टाइप 7 HTML ब्लॉक के लिए विशेषताएं सही ढंग से पार्स की जाती हैं
- जब विशेषताएं पहले से पार्स हो चुकी हों तो React कंपाइलर `rawText` को दोबारा पार्स करने के बजाय पार्स किए गए `children` सरणी का उपयोग करता है
