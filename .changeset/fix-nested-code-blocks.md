---
"markdown-to-jsx": patch
---

Fix fenced code blocks consuming nested code block openings as content.

When a fenced code block with a language (e.g., ` ```markdown`) encountered another code block opening with a language (e.g., ` ```python`) inside it, the inner opening was incorrectly treated as content instead of being recognized as a new block. Now, fence lines with a language immediately following (no space between fence and language) are recognized as new block openings that implicitly close the previous block.

This matches behavior of other markdown renderers like GitHub and VSCode. Lines like ` ``` aaa` (with space before info string) remain treated as content per CommonMark spec.

---

修复了围栏代码块将嵌套代码块开头作为内容消费的问题。

当带有语言的围栏代码块（例如 ` ```markdown`）内部遇到另一个带语言的代码块开头（例如 ` ```python`）时，内部开头被错误地视为内容，而不是被识别为新块。现在，语言紧随其后（围栏和语言之间没有空格）的围栏行被识别为隐式关闭前一个块的新块开头。

这与 GitHub 和 VSCode 等其他 markdown 渲染器的行为一致。按照 CommonMark 规范，像 ` ``` aaa`（信息字符串前有空格）这样的行仍被视为内容。

---

फेंस्ड कोड ब्लॉक्स द्वारा नेस्टेड कोड ब्लॉक ओपनिंग को सामग्री के रूप में उपभोग करने की समस्या को ठीक किया।

जब भाषा वाला फेंस्ड कोड ब्लॉक (जैसे ` ```markdown`) के अंदर भाषा वाला दूसरा कोड ब्लॉक ओपनिंग (जैसे ` ```python`) आता था, तो आंतरिक ओपनिंग को नए ब्लॉक के रूप में पहचानने के बजाय गलती से सामग्री के रूप में माना जाता था। अब, भाषा तुरंत बाद आने वाली (फेंस और भाषा के बीच कोई स्पेस नहीं) फेंस लाइनें नए ब्लॉक ओपनिंग के रूप में पहचानी जाती हैं जो पिछले ब्लॉक को निहित रूप से बंद करती हैं।

यह GitHub और VSCode जैसे अन्य markdown रेंडरर के व्यवहार से मेल खाता है। CommonMark स्पेक के अनुसार ` ``` aaa` (इन्फो स्ट्रिंग से पहले स्पेस) जैसी लाइनें अभी भी सामग्री के रूप में मानी जाती हैं।
