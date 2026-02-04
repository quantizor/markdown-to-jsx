---
'markdown-to-jsx': patch
---

Bypass React.createElement for ~2x faster JSX output by constructing raw React element objects directly. The $$typeof symbol is auto-detected from the installed React version for forward compatibility. Falls back to createElement when a custom createElement option is provided.

绕过 React.createElement，通过直接构造原始 React 元素对象实现约 2 倍的 JSX 输出速度提升。$$typeof 符号从已安装的 React 版本自动检测以确保前向兼容性。当提供自定义 createElement 选项时回退到 createElement。

React.createElement को बायपास करके कच्चे React एलिमेंट ऑब्जेक्ट सीधे बनाकर ~2x तेज़ JSX आउटपुट। $$typeof सिंबल आगे की संगतता के लिए स्थापित React संस्करण से स्वतः पहचाना जाता है। कस्टम createElement विकल्प प्रदान करने पर createElement पर वापस आता है।
