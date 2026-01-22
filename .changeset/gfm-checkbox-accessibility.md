---
"markdown-to-jsx": minor
---

GFM task list checkboxes now include proper `<label>` elements with matching `id` and `for` attributes for improved accessibility. This allows screen readers to properly announce what each checkbox represents.

**Before:**
```html
<li><input type="checkbox"/> Task text</li>
```

**After:**
```html
<li><input id="task-1" type="checkbox"/><label for="task-1"> Task text</label></li>
```

React adapter uses `React.useId` (React 18+) with fallback counter for older versions. HTML, SolidJS, and Vue adapters use a global counter for ID generation.

GFM task 列表复选框现在包含带有匹配的 `id` 和 `for` 属性的正确 `<label>` 元素，以提高可访问性。这允许屏幕阅读器正确地宣布每个复选框代表什么。

GFM टास्क लिस्ट चेकबॉक्स अब एक्सेसिबिलिटी में सुधार के लिए मिलान `id` और `for` एट्रिब्यूट्स के साथ उचित `<label>` एलिमेंट्स शामिल करते हैं। यह स्क्रीन रीडर्स को प्रत्येक चेकबॉक्स का प्रतिनिधित्व करने वाली चीज़ को ठीक से घोषित करने की अनुमति देता है।
