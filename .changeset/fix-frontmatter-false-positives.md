---
'markdown-to-jsx': patch
---

Fix frontmatter detection silently consuming content when a thematic break (`---`) starts the document. The colon-anywhere heuristic is replaced with proper YAML key-value validation, and a new `disableFrontmatter` option is added to skip detection entirely.

修复当文档以主题分隔线（`---`）开头时，前置元数据检测静默吞噬内容的问题。将"任意冒号"启发式规则替换为正确的 YAML 键值验证，并新增 `disableFrontmatter` 选项以完全跳过检测。

दस्तावेज़ की शुरुआत में विषयगत विभाजक (`---`) होने पर फ्रंटमैटर पहचान द्वारा सामग्री को चुपचाप हटाने की समस्या ठीक की गई। "कहीं भी कोलन" अनुमान को सही YAML कुंजी-मान सत्यापन से बदला गया, और पहचान को पूरी तरह से छोड़ने के लिए नया `disableFrontmatter` विकल्प जोड़ा गया।
