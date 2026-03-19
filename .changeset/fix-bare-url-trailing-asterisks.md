---
"markdown-to-jsx": patch
---

fix: strip trailing asterisks from bare URL href (fixes #839)

When a bare URL was wrapped in bold markdown (`**url**`), the generated link's `href` incorrectly included the closing asterisks (e.g. `href="https://example.com/foo**"`). The parser now trims trailing `*` from bare URLs so the href is correct. No consumer changes required.

当裸 URL 包裹在粗体 markdown（`**url**`）中时，生成的链接 `href` 错误地包含了闭合星号（例如 `href="https://example.com/foo**"`）。解析器现在会从裸 URL 中去除尾部的 `*`，使 href 正确。无需更改消费者代码。

जब एक बेयर URL बोल्ड markdown (`**url**`) में लपेटा गया था, तो जनरेट किए गए लिंक का `href` गलत तरीके से क्लोज़िंग एस्टेरिस्क शामिल करता था (जैसे `href="https://example.com/foo**"`)। पार्सर अब बेयर URL से अनुगामी `*` को हटा देता है ताकि href सही हो। कोई उपभोक्ता परिवर्तन आवश्यक नहीं है।
