---
'markdown-to-jsx': patch
---

Fix entity resolution in CodeSandbox and other bundlers by exposing entities as a public subpath export. Bundlers now resolve `markdown-to-jsx/entities` using the `browser` condition, ensuring the optimized DOM-based decoder (~300B) is used in browsers instead of the full entity table (~29KB).

通过将实体作为公共子路径导出来修复 CodeSandbox 和其他打包工具中的实体解析。打包工具现在使用 `browser` 条件解析 `markdown-to-jsx/entities`，确保浏览器使用优化的基于 DOM 的解码器（约 300B）而不是完整的实体表（约 29KB）。

CodeSandbox और अन्य बंडलर में एंटिटी रिज़ॉल्यूशन को ठीक करने के लिए एंटिटी को सार्वजनिक सबपाथ एक्सपोर्ट के रूप में एक्सपोज़ किया गया। बंडलर अब `browser` कंडीशन का उपयोग करके `markdown-to-jsx/entities` को रिज़ॉल्व करते हैं, यह सुनिश्चित करते हुए कि ब्राउज़र में पूर्ण एंटिटी टेबल (~29KB) के बजाय ऑप्टिमाइज़्ड DOM-आधारित डिकोडर (~300B) का उपयोग किया जाता है।
