---
"markdown-to-jsx": patch
---

Fix: Jest test suites failing with "Unexpected token 'export'" when using the library with jsdom environment. The `browser` condition in the package.json `imports` field now correctly provides both ESM (`import`) and CJS (`require`) sub-conditions, ensuring Jest resolves to the CommonJS version of the browser entities module.

修复：当在 jsdom 环境中使用该库时，Jest 测试套件会因"Unexpected token 'export'"而失败。package.json `imports` 字段中的 `browser` 条件现在正确提供 ESM（`import`）和 CJS（`require`）子条件，确保 Jest 解析到浏览器实体模块的 CommonJS 版本。

फिक्स: jsdom वातावरण में लाइब्रेरी का उपयोग करते समय Jest टेस्ट सुइट "Unexpected token 'export'" त्रुटि के साथ विफल हो रहे थे। package.json `imports` फ़ील्ड में `browser` कंडीशन अब सही ढंग से ESM (`import`) और CJS (`require`) सब-कंडीशन प्रदान करती है, जिससे Jest ब्राउज़र एंटिटी मॉड्यूल के CommonJS संस्करण को सही ढंग से रिज़ॉल्व करता है।
