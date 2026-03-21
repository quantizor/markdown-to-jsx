---
'markdown-to-jsx': patch
---

Fix streaming mode incorrectly stripping self-closing custom component tags (e.g. `<CustomButton />`) and leaking incomplete trailing tags as escaped text in inline content.

修复流式模式错误地移除自闭合自定义组件标签（如 `<CustomButton />`），以及内联内容中不完整的尾部标签作为转义文本泄漏的问题。

स्ट्रीमिंग मोड में सेल्फ-क्लोज़िंग कस्टम कंपोनेंट टैग (जैसे `<CustomButton />`) को गलत तरीके से हटाने और इनलाइन कंटेंट में अपूर्ण ट्रेलिंग टैग को एस्केप्ड टेक्स्ट के रूप में लीक होने की समस्या को ठीक करें।
