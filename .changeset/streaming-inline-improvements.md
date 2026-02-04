---
"markdown-to-jsx": patch
---

Improved `optimizeForStreaming` handling of incomplete inline syntax. Bold/italic/strikethrough markers, links, images, and nested badge constructs (`[![alt](img)](url)`) now stream cleanly without flashing raw markdown syntax. Incomplete images are fully suppressed instead of showing alt text.

改进了 `optimizeForStreaming` 对不完整内联语法的处理。粗体/斜体/删除线标记、链接、图片和嵌套徽章构造（`[![alt](img)](url)`）现在可以流畅地流式传输，不会闪烁原始 markdown 语法。不完整的图片会被完全抑制，而不是显示替代文本。

`optimizeForStreaming` में अपूर्ण इनलाइन सिंटैक्स की हैंडलिंग में सुधार। बोल्ड/इटैलिक/स्ट्राइकथ्रू मार्कर, लिंक, इमेज, और नेस्टेड बैज कंस्ट्रक्ट (`[![alt](img)](url)`) अब raw markdown सिंटैक्स की झलक के बिना सुचारू रूप से स्ट्रीम होते हैं। अपूर्ण इमेज alt टेक्स्ट दिखाने के बजाय पूरी तरह से दबा दी जाती हैं।
