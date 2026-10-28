---
"markdown-to-jsx": patch
---

With `optimizeForStreaming`, finished text is no longer changed. Underscores and asterisks that are plain text, such as `customer_id`, `SELECT * FROM`, and `2*3`, along with text inside inline code, URLs, `<https://...>` links, and raw HTML, now render exactly as they do without the option. Unfinished bold, italic, strikethrough, links, inline code, and HTML are held back only in the last paragraph, list item, or quote, where more text can still arrive; earlier blocks render as written.

Streaming also no longer removes closing HTML tags or elements such as `<img>` and `<br>`, no longer drops `<https://...>` links, no longer flashes raw `|` characters for a partial table at the end of a quote, and stays fast on text with many unmatched `[` characters.
