---
"markdown-to-jsx": patch
---

Fixed attribute casing preservation across all output adapters. The parser no longer modifies attribute names; each adapter handles its own mappings. React/Native convert to JSX props (class->className, XML namespaces via colon-to-camelCase heuristic). Solid uses `class` per framework guidance. Vue passes HTML attributes directly.

修复了所有输出适配器中的属性大小写保留。解析器不再修改属性名称；每个适配器处理自己的映射。React/Native 转换为 JSX 属性（class->className，XML 命名空间通过冒号转驼峰启发式）。Solid 按框架指南使用 `class`。Vue 直接传递 HTML 属性。

सभी आउटपुट एडेप्टर में एट्रिब्यूट केसिंग संरक्षण ठीक किया गया। पार्सर अब एट्रिब्यूट नामों को संशोधित नहीं करता; प्रत्येक एडेप्टर अपनी मैपिंग संभालता है। React/Native JSX props में बदलता है (class->className, XML नेमस्पेस कोलन-टू-कैमलकेस से)। Solid फ्रेमवर्क दिशानिर्देश के अनुसार `class` उपयोग करता है। Vue सीधे HTML एट्रिब्यूट पास करता है।
