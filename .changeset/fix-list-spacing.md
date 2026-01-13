---
"markdown-to-jsx": patch
---

Fixed inconsistent spacing between list item nodes when continuation lines have indentation equal to the nested list marker. Previously, text nodes in list items were being concatenated without newlines when continuation lines matched the list's base indentation, causing missing line breaks in the rendered output.
