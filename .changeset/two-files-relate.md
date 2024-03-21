---
"markdown-to-jsx": patch
---

Fix HTML block regex for custom component scenarios where a nested component shares the same prefix as the parent, e.g. Accordion vs AccordionItem.
