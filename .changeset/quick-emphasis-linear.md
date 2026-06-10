---
'markdown-to-jsx': patch
---

Documents with many bold or italic spans now parse in a fraction of the time. Previously, parsing slowed down sharply as the number of emphasized spans grew, which could make very large or adversarial inputs hang.
