---
'markdown-to-jsx': patch
---

Fix lazy continuation lines for list items when continuation text appears at base indentation without a blank line. Previously, continuation text was incorrectly appended inline to the list item. Now both the existing inline content and the continuation text are properly wrapped in separate paragraphs.
