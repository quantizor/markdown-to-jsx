---
"markdown-to-jsx": patch
---

With `optimizeForStreaming`, underscores and asterisks that are plain text are no longer deleted. Identifiers like `customer_id`, `SELECT * FROM`, and `2*3`, along with text inside inline code, URLs, `<https://...>` links, and raw HTML, now render exactly as they do without the option. A bold or italic marker still waiting for its closing marker is held back only in the last paragraph, list item, or quote, where more text can still arrive; earlier blocks keep their text unchanged. Links written as `<https://...>` no longer disappear during streaming, and a partial table at the end of a quote no longer flashes raw `|` characters.
