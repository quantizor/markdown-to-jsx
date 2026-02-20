---
'markdown-to-jsx': patch
---

fix: add missing `_owner` field on raw React elements for dev-mode compatibility

Fixes "Cannot set properties of undefined (setting 'validated')" errors in React 19 dev mode by adding the `_owner` field that React's reconciler expects on all elements.

修复：在原始 React 元素上添加缺失的 `_owner` 字段，解决 React 19 开发模式下的兼容性问题。

सुधार: React 19 डेवलपमेंट मोड में "Cannot set properties of undefined" त्रुटि को ठीक करने के लिए raw React तत्वों पर गायब `_owner` फ़ील्ड जोड़ा गया।
