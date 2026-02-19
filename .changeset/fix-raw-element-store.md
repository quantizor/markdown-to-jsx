---
"markdown-to-jsx": patch
---

Fix "Cannot set properties of undefined (setting 'validated')" error introduced in 9.7.1. React's dev-mode reconciler sets `element._store.validated` to track element creation source; raw elements created by the fast path now include `_store: {}` in non-production builds.

修复 9.7.1 引入的 "Cannot set properties of undefined (setting 'validated')" 错误。React 开发模式协调器设置 `element._store.validated` 来追踪元素创建来源；快速路径创建的原始元素现在在非生产构建中包含 `_store: {}`。

9.7.1 में पेश हुई "Cannot set properties of undefined (setting 'validated')" त्रुटि ठीक की गई। React के dev-mode reconciler द्वारा `element._store.validated` सेट करने के लिए, फास्ट पाथ से बनाए गए raw elements अब non-production builds में `_store: {}` शामिल करते हैं।
