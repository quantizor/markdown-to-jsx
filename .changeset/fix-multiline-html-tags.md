---
"markdown-to-jsx": patch
---

Fix duplicate opening tags for HTML elements with multi-line attributes (#781)

HTML tags with attributes spanning multiple lines (like custom elements with `data-*` attributes on separate lines) no longer produce duplicate opening tags in the output. This restores the expected behavior for custom HTML elements used with component overrides.

---

修复多行属性的 HTML 元素产生重复开始标签的问题（#781）

具有跨多行属性的 HTML 标签（例如在不同行上具有 `data-*` 属性的自定义元素）不再在输出中产生重复的开始标签。这恢复了与组件覆盖一起使用的自定义 HTML 元素的预期行为。

---

बहु-पंक्ति विशेषताओं वाले HTML तत्वों के लिए दोहरे आरंभिक टैग ठीक करें (#781)

कई पंक्तियों में फैली विशेषताओं वाले HTML टैग (जैसे अलग-अलग पंक्तियों पर `data-*` विशेषताओं वाले कस्टम तत्व) अब आउटपुट में दोहरे आरंभिक टैग उत्पन्न नहीं करते। यह कंपोनेंट ओवरराइड के साथ उपयोग किए जाने वाले कस्टम HTML तत्वों के अपेक्षित व्यवहार को पुनर्स्थापित करता है।
