---
"markdown-to-jsx": patch
---

Fix: preserve camelCase attribute casing for all HTML/JSX tags, not just PascalCase components. This restores expected behavior where attributes like `userId` and `firstName` are no longer lowercased to `userid` and `firstname`.

修复：为所有 HTML/JSX 标签保留 camelCase 属性大小写，而不仅仅是 PascalCase 组件。这恢复了预期行为，使得 `userId` 和 `firstName` 等属性不再被转换为小写的 `userid` 和 `firstname`。

फिक्स: सभी HTML/JSX टैग के लिए camelCase एट्रिब्यूट केसिंग को संरक्षित करें, न कि केवल PascalCase कंपोनेंट के लिए। यह अपेक्षित व्यवहार को बहाल करता है जहां `userId` और `firstName` जैसे एट्रिब्यूट अब लोअरकेस `userid` और `firstname` में परिवर्तित नहीं होते हैं।
