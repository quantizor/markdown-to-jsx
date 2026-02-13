---
"markdown-to-jsx": patch
---

- Fix HTML entity decoding in link titles (e.g. `&ndash;` now correctly decodes to `–`)
- Fix bare email autolinks matching when DNS labels exceed 63 characters
- Fix `<pre>`, `<script>`, `<style>`, and `<textarea>` content being incorrectly parsed as markdown instead of rendered verbatim

---

- 修复链接标题中的 HTML 实体解码（如 `&ndash;` 现在正确解码为 `–`）
- 修复 DNS 标签超过 63 个字符时裸邮件自动链接的错误匹配
- 修复 `<pre>`、`<script>`、`<style>` 和 `<textarea>` 内容被错误解析为 Markdown 而非原始文本渲染的问题

---

- लिंक शीर्षकों में HTML एंटिटी डिकोडिंग ठीक करें (जैसे `&ndash;` अब सही ढंग से `–` में बदलता है)
- DNS लेबल 63 अक्षरों से अधिक होने पर बेयर ईमेल ऑटोलिंक की गलत मैचिंग ठीक करें
- `<pre>`, `<script>`, `<style>`, और `<textarea>` सामग्री को Markdown के बजाय यथावत् रेंडर करें
