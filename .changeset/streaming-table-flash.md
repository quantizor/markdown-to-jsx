---
"markdown-to-jsx": patch
---

While streaming markdown with `optimizeForStreaming`, a table renders smoothly instead of flashing raw syntax. A partial table (a header row before its divider row, or the opening `|` of a new table) stays hidden until enough has streamed in to render, and once the table appears it no longer disappears and reappears as each new row arrives. This holds consistently across every renderer.
