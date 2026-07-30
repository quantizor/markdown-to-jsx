---
'markdown-to-jsx': minor
---

Headings that share the same text now get unique HTML ids automatically (`introduction`, `introduction-1`, `introduction-2`), matching the usual Markdown hosting behavior. A custom `slugify` still controls the base string; uniqueness is applied afterward, so you no longer need a stateful slugify closure that breaks under React Strict Mode.
