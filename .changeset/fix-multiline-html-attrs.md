---
"markdown-to-jsx": patch
---

Fixed HTML tags with attributes spanning multiple lines being incorrectly parsed.

Previously, HTML tags with attributes on separate lines (like `<dl-custom\n  data-variant='horizontalTable'\n>`) would have their attributes incorrectly parsed, sometimes causing duplicate tags or missing attribute values. This fix ensures that newlines between HTML attributes are properly recognized as whitespace separators.

@lang zh
修复了属性跨多行的 HTML 标签解析不正确的问题。

之前，属性位于单独行上的 HTML 标签（如 `<dl-custom\n  data-variant='horizontalTable'\n>`）的属性解析不正确，有时会导致重复的标签或缺失属性值。此修复确保 HTML 属性之间的换行符被正确识别为空白分隔符。

@lang hi
कई पंक्तियों में फैले एट्रिब्यूट वाले HTML टैग्स के गलत पार्सिंग को ठीक किया।

पहले, अलग-अलग पंक्तियों पर एट्रिब्यूट वाले HTML टैग्स (जैसे `<dl-custom\n  data-variant='horizontalTable'\n>`) के एट्रिब्यूट गलत तरीके से पार्स होते थे, जिससे कभी-कभी डुप्लिकेट टैग्स या गायब एट्रिब्यूट वैल्यू होते थे। यह फिक्स सुनिश्चित करता है कि HTML एट्रिब्यूट के बीच न्यूलाइन को व्हाइटस्पेस सेपरेटर के रूप में सही ढंग से पहचाना जाता है।
