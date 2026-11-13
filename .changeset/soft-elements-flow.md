---
'markdown-to-jsx': patch
---

Fixed: rendering under non-React runtimes such as Preact aliased as `react` (e.g. `preact/compat`). Element creation now detects at load time whether the runtime uses React's internal element shape — including rejecting Preact vnodes, which mimic React's `$$typeof` marker — and delegates to the runtime's own `createElement` when it does not. Previously the hand-built element objects were silently unrenderable by Preact, producing blank output.
