---
"markdown-to-jsx": patch
---

Raw HTML in your markdown is now stripped of dangerous attributes before it reaches output, closing a cross-site scripting hole that affected every renderer. Inline event handlers (`onclick`, `onerror`, `onload`, and any other `on*` attribute) and URL attributes carrying a `javascript:`, `vbscript:`, or non-image `data:` scheme (in `href`, `src`, `action`, `formaction`, `poster`, `cite`, and similar) are removed, `srcdoc` is dropped, and schemes hidden behind HTML entities such as `java&#9;script:` are caught too. Safe attributes keep their original formatting, `data:image` URLs still work, and event handlers passed as expressions to your own components (`<MyButton onClick={fn} />`), along with bare boolean props on them (`<MyButton onClick />`), are preserved. Previously the HTML and Markdown string outputs emitted these attributes verbatim, and Solid and Vue injected them without protection.
