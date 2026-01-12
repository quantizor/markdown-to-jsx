---
"markdown-to-jsx": patch
---

The `text` field in HTML AST nodes now contains cleaned inner content without opening/closing tags. Use `rawText` for full raw HTML. This affects custom `renderRule` implementations that rely on the `text` field.

HTML AST 节点中的 `text` 字段现在包含不带开/闭标签的清理后内容。使用 `rawText` 获取完整原始 HTML。这会影响依赖 `text` 字段的自定义 `renderRule` 实现。

HTML AST नोड्स में `text` फ़ील्ड अब ओपनिंग/क्लोज़िंग टैग्स के बिना साफ़ इनर कंटेंट रखता है। पूर्ण raw HTML के लिए `rawText` का उपयोग करें। यह उन कस्टम `renderRule` कार्यान्वयनों को प्रभावित करता है जो `text` फ़ील्ड पर निर्भर हैं।
