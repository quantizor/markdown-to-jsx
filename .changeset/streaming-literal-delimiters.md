---
"markdown-to-jsx": patch
---

With `optimizeForStreaming`, underscores and asterisks that are plain text are no longer deleted. Identifiers like `customer_id`, `SELECT * FROM`, and `2*3`, along with text inside inline code, URLs, and `<https://...>` links, now render exactly as they do without the option. Only a bold or italic marker that is still waiting for its closing marker is held back. Links written as `<https://...>` also no longer disappear during streaming.
