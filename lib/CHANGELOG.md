# markdown-to-jsx

## 9.7.12

### Patch Changes

- 1c430ae: Fix missing TypeScript declaration files in published package. Add standalone post-build verification that fails the build when type declarations are not generated, independent of the bundler's plugin system.

  发布包中缺少 TypeScript 声明文件的修复。添加独立的构建后验证，当类型声明未生成时构建失败，不依赖于打包器的插件系统。

  प्रकाशित पैकेज में गायब TypeScript डिक्लेरेशन फ़ाइलों को ठीक करें। स्वतंत्र बिल्ड-बाद सत्यापन जोड़ें जो टाइप डिक्लेरेशन जनरेट न होने पर बिल्ड विफल करे, बंडलर के प्लगइन सिस्टम से स्वतंत्र।

## 9.7.11

### Patch Changes

- 5eecb05: Skip rendering empty tbody when a table has only a header row and no data rows.

  仅有表头行而无数据行的表格不再渲染空的 tbody。

  केवल हेडर पंक्ति और कोई डेटा पंक्ति न होने पर खाली tbody रेंडर नहीं किया जाता।

- 130cc33: Suppress React 19 RSC development warning about missing internal properties on manually-created elements.

  修复 React 19 RSC 开发模式下手动创建的元素缺少内部属性时产生的警告。

  React 19 RSC के विकास मोड में मैन्युअल रूप से बनाए गए तत्वों पर आंतरिक गुणों की अनुपस्थिति संबंधी चेतावनी को ठीक किया।

## 9.7.10

### Patch Changes

- 3daa41e: fix: strip trailing asterisks from bare URL href (fixes #839)

  When a bare URL was wrapped in bold markdown (`**url**`), the generated link's `href` incorrectly included the closing asterisks (e.g. `href="https://example.com/foo**"`). The parser now trims trailing `*` from bare URLs so the href is correct. No consumer changes required.

  当裸 URL 包裹在粗体 markdown（`**url**`）中时，生成的链接 `href` 错误地包含了闭合星号（例如 `href="https://example.com/foo**"`）。解析器现在会从裸 URL 中去除尾部的 `*`，使 href 正确。无需更改消费者代码。

  जब एक बेयर URL बोल्ड markdown (`**url**`) में लपेटा गया था, तो जनरेट किए गए लिंक का `href` गलत तरीके से क्लोज़िंग एस्टेरिस्क शामिल करता था (जैसे `href="https://example.com/foo**"`)। पार्सर अब बेयर URL से अनुगामी `*` को हटा देता है ताकि href सही हो। कोई उपभोक्ता परिवर्तन आवश्यक नहीं है।

- f520531: resolve emphasis delimiters closing before hard line breaks (two trailing spaces or backslash before newline)

  解决在硬换行符（换行前有两个尾随空格或反斜杠）之前关闭强调分隔符的问题

  हार्ड लाइन ब्रेक (न्यूलाइन से पहले दो ट्रेलिंग स्पेस या बैकस्लैश) से पहले एम्फ़ैसिस डिलीमिटर बंद होने की समस्या हल की

- f520531: include \_store on raw React elements unconditionally so React dev-mode validation works in all bundler environments

  无条件地在原始 React 元素上包含 \_store，使 React 开发模式验证在所有打包器环境中正常工作

  सभी बंडलर वातावरण में React डेव-मोड सत्यापन काम करने के लिए रॉ React एलिमेंट्स पर बिना शर्त \_store शामिल करें

## 9.7.9

### Patch Changes

- 2d21e43: Fail the build when type declarations are not generated, preventing releases without TypeScript types.

  当类型声明未生成时构建失败，防止发布缺少 TypeScript 类型的版本。

  टाइप डिक्लेरेशन जनरेट न होने पर बिल्ड विफल करें, TypeScript टाइप्स के बिना रिलीज़ को रोकें।

## 9.7.8

### Patch Changes

- 58502fc: Resolve broken exports in bundled output caused by Bun bundler bug with cross-entry re-exports

  解决由 Bun 打包器跨入口点重导出 bug 导致的打包输出中导出失效问题

  Bun बंडलर के क्रॉस-एंट्री री-एक्सपोर्ट बग से होने वाली बंडल आउटपुट में टूटी हुई exports को ठीक किया

## 9.7.7

### Patch Changes

- e0100f0: fix: nested HTML blocks with same tag name now correctly match depth-paired closing tags

  修复：嵌套的同名 HTML 块现在能正确匹配深度配对的关闭标签

  修正：समान टैग नाम वाले नेस्टेड HTML ब्लॉक अब सही ढंग से गहराई-युग्मित समापन टैग से मिलान करते हैं

- bf5d906: fix: suppress ambiguous setext headings during streaming to avoid premature heading rendering

  修复：在流式传输过程中抑制歧义的 Setext 标题，避免过早渲染标题

  修正：स्ट्रीमिंग के दौरान अस्पष्ट Setext शीर्षकों को दबाएं ताकि समय से पहले शीर्षक प्रदर्शन न हो

## 9.7.6

### Patch Changes

- 565e3ea: fix: add missing `_owner` field on raw React elements for dev-mode compatibility

  Fixes "Cannot set properties of undefined (setting 'validated')" errors in React 19 dev mode by adding the `_owner` field that React's reconciler expects on all elements.

  修复：在原始 React 元素上添加缺失的 `_owner` 字段，解决 React 19 开发模式下的兼容性问题。

  सुधार: React 19 डेवलपमेंट मोड में "Cannot set properties of undefined" त्रुटि को ठीक करने के लिए raw React तत्वों पर गायब `_owner` फ़ील्ड जोड़ा गया।

- 565e3ea: fix: prevent void elements from receiving children when preceded by a blank line

  Void HTML elements (e.g. `<br>`, `<hr>`, `<img>`) preceded by a blank line no longer cause React error #137. The parser now returns void elements as content-less blocks, and all compilers guard against passing children to void elements.

  修复：当空行后跟空元素（如 `<br>`、`<hr>`、`<img>`）时，不再触发 React 错误 #137。解析器现在将空元素作为无内容块返回，所有编译器均防止向空元素传递子元素。

  सुधार: जब खाली पंक्ति के बाद void तत्व (जैसे `<br>`, `<hr>`, `<img>`) आते हैं, तो अब React त्रुटि #137 नहीं होती। पार्सर अब void तत्वों को बिना सामग्री वाले ब्लॉक के रूप में लौटाता है, और सभी कंपाइलर void तत्वों को चाइल्ड तत्व देने से रोकते हैं।

## 9.7.5

### Patch Changes

- cc1a8a7: Fix "Cannot set properties of undefined (setting 'validated')" error introduced in 9.7.1. React's dev-mode reconciler sets `element._store.validated` to track element creation source; raw elements created by the fast path now include `_store: {}` in non-production builds.

  修复 9.7.1 引入的 "Cannot set properties of undefined (setting 'validated')" 错误。React 开发模式协调器设置 `element._store.validated` 来追踪元素创建来源；快速路径创建的原始元素现在在非生产构建中包含 `_store: {}`。

  9.7.1 में पेश हुई "Cannot set properties of undefined (setting 'validated')" त्रुटि ठीक की गई। React के dev-mode reconciler द्वारा `element._store.validated` सेट करने के लिए, फास्ट पाथ से बनाए गए raw elements अब non-production builds में `_store: {}` शामिल करते हैं।

## 9.7.4

### Patch Changes

- 01b68df: - Fix HTML entity decoding in link titles (e.g. `&ndash;` now correctly decodes to `–`)
  - Fix bare email autolinks matching when DNS labels exceed 63 characters
  - Fix `<pre>`, `<script>`, `<style>`, and `<textarea>` content being incorrectly parsed as markdown instead of rendered verbatim

  ***
  - 修复链接标题中的 HTML 实体解码（如 `&ndash;` 现在正确解码为 `–`）
  - 修复 DNS 标签超过 63 个字符时裸邮件自动链接的错误匹配
  - 修复 `<pre>`、`<script>`、`<style>` 和 `<textarea>` 内容被错误解析为 Markdown 而非原始文本渲染的问题

  ***
  - लिंक शीर्षकों में HTML एंटिटी डिकोडिंग ठीक करें (जैसे `&ndash;` अब सही ढंग से `–` में बदलता है)
  - DNS लेबल 63 अक्षरों से अधिक होने पर बेयर ईमेल ऑटोलिंक की गलत मैचिंग ठीक करें
  - `<pre>`, `<script>`, `<style>`, और `<textarea>` सामग्री को Markdown के बजाय यथावत् रेंडर करें

## 9.7.3

### Patch Changes

- 2dca780: Improve HTML compiler performance by ~57%, bringing it to parity with the React compiler.

  HTML 编译器性能提升约 57%，与 React 编译器持平。

  HTML कंपाइलर के प्रदर्शन में ~57% सुधार, React कंपाइलर के बराबर।

## 9.7.2

### Patch Changes

- 30db3f3: Accept case-insensitive GFM alert blockquote syntax (e.g., `[!Tip]`, `[!tip]`) matching GitHub's behavior.

  接受不区分大小写的 GFM 警告引用块语法（例如 `[!Tip]`、`[!tip]`），与 GitHub 的行为保持一致。

  GFM अलर्ट ब्लॉककोट सिंटैक्स में केस-इनसेंसिटिव मिलान स्वीकार करें (जैसे `[!Tip]`, `[!tip]`), GitHub के व्यवहार के अनुरूप।

- da2eb8c: Moved benchmarking and documentation website dev dependencies out of the library package for cleaner dependency management.

  将基准测试和文档网站开发依赖项移出库包以实现更清晰的依赖管理。

  बेंचमार्किंग और डॉक्यूमेंटेशन वेबसाइट डेव डिपेंडेंसी को साफ डिपेंडेंसी मैनेजमेंट के लिए लाइब्रेरी पैकेज से बाहर ले जाया गया।

## 9.7.1

### Patch Changes

- 9830b70: Fix entity resolution in CodeSandbox and other bundlers by exposing entities as a public subpath export. Bundlers now resolve `markdown-to-jsx/entities` using the `browser` condition, ensuring the optimized DOM-based decoder (~300B) is used in browsers instead of the full entity table (~29KB).

  通过将实体作为公共子路径导出来修复 CodeSandbox 和其他打包工具中的实体解析。打包工具现在使用 `browser` 条件解析 `markdown-to-jsx/entities`，确保浏览器使用优化的基于 DOM 的解码器（约 300B）而不是完整的实体表（约 29KB）。

  CodeSandbox और अन्य बंडलर में एंटिटी रिज़ॉल्यूशन को ठीक करने के लिए एंटिटी को सार्वजनिक सबपाथ एक्सपोर्ट के रूप में एक्सपोज़ किया गया। बंडलर अब `browser` कंडीशन का उपयोग करके `markdown-to-jsx/entities` को रिज़ॉल्व करते हैं, यह सुनिश्चित करते हुए कि ब्राउज़र में पूर्ण एंटिटी टेबल (~29KB) के बजाय ऑप्टिमाइज़्ड DOM-आधारित डिकोडर (~300B) का उपयोग किया जाता है।

- e537dca: Bypass React.createElement for ~2x faster JSX output by constructing raw React element objects directly. The $$typeof symbol is auto-detected from the installed React version for forward compatibility. Falls back to createElement when a custom createElement option is provided.

  绕过 React.createElement，通过直接构造原始 React 元素对象实现约 2 倍的 JSX 输出速度提升。$$typeof 符号从已安装的 React 版本自动检测以确保前向兼容性。当提供自定义 createElement 选项时回退到 createElement。

  React.createElement को बायपास करके कच्चे React एलिमेंट ऑब्जेक्ट सीधे बनाकर ~2x तेज़ JSX आउटपुट। $$typeof सिंबल आगे की संगतता के लिए स्थापित React संस्करण से स्वतः पहचाना जाता है। कस्टम createElement विकल्प प्रदान करने पर createElement पर वापस आता है।

## 9.7.0

### Minor Changes

- ab93d7b: Replaced the rule-based markdown parser with a compact table-driven parser. Parsing is 27-82% faster depending on input size and bundle size is reduced by ~25% (gzip). Improved CommonMark compliance for HTML block handling and streaming mode reliability. No API changes.

  用紧凑的表驱动解析器替换了基于规则的 markdown 解析器。根据输入大小，解析速度提升 27-82%，包体积减少约 25%（gzip）。改进了 HTML 块处理和流式模式可靠性的 CommonMark 合规性。无 API 更改。

  नियम-आधारित markdown पार्सर को कॉम्पैक्ट टेबल-ड्रिवन पार्सर से बदला गया। इनपुट आकार के अनुसार पार्सिंग 27-82% तेज़ है और बंडल आकार ~25% (gzip) कम हुआ। HTML ब्लॉक हैंडलिंग और स्ट्रीमिंग मोड विश्वसनीयता के लिए CommonMark अनुपालन में सुधार। कोई API परिवर्तन नहीं।

### Patch Changes

- ab93d7b: Fixed attribute casing preservation across all output adapters. The parser no longer modifies attribute names; each adapter handles its own mappings. React/Native convert to JSX props (class->className, XML namespaces via colon-to-camelCase heuristic). Solid uses `class` per framework guidance. Vue passes HTML attributes directly.

  修复了所有输出适配器中的属性大小写保留。解析器不再修改属性名称；每个适配器处理自己的映射。React/Native 转换为 JSX 属性（class->className，XML 命名空间通过冒号转驼峰启发式）。Solid 按框架指南使用 `class`。Vue 直接传递 HTML 属性。

  सभी आउटपुट एडेप्टर में एट्रिब्यूट केसिंग संरक्षण ठीक किया गया। पार्सर अब एट्रिब्यूट नामों को संशोधित नहीं करता; प्रत्येक एडेप्टर अपनी मैपिंग संभालता है। React/Native JSX props में बदलता है (class->className, XML नेमस्पेस कोलन-टू-कैमलकेस से)। Solid फ्रेमवर्क दिशानिर्देश के अनुसार `class` उपयोग करता है। Vue सीधे HTML एट्रिब्यूट पास करता है।

- ab93d7b: Improved `optimizeForStreaming` handling of incomplete inline syntax. Bold/italic/strikethrough markers, links, images, and nested badge constructs (`[![alt](img)](url)`) now stream cleanly without flashing raw markdown syntax. Incomplete images are fully suppressed instead of showing alt text.

  改进了 `optimizeForStreaming` 对不完整内联语法的处理。粗体/斜体/删除线标记、链接、图片和嵌套徽章构造（`[![alt](img)](url)`）现在可以流畅地流式传输，不会闪烁原始 markdown 语法。不完整的图片会被完全抑制，而不是显示替代文本。

  `optimizeForStreaming` में अपूर्ण इनलाइन सिंटैक्स की हैंडलिंग में सुधार। बोल्ड/इटैलिक/स्ट्राइकथ्रू मार्कर, लिंक, इमेज, और नेस्टेड बैज कंस्ट्रक्ट (`[![alt](img)](url)`) अब raw markdown सिंटैक्स की झलक के बिना सुचारू रूप से स्ट्रीम होते हैं। अपूर्ण इमेज alt टेक्स्ट दिखाने के बजाय पूरी तरह से दबा दी जाती हैं।

## 9.6.1

### Patch Changes

- 9bf4bad: Fix: Jest test suites failing with "Unexpected token 'export'" when using the library with jsdom environment. The `browser` condition in the package.json `imports` field now correctly provides both ESM (`import`) and CJS (`require`) sub-conditions, ensuring Jest resolves to the CommonJS version of the browser entities module.

  修复：当在 jsdom 环境中使用该库时，Jest 测试套件会因"Unexpected token 'export'"而失败。package.json `imports` 字段中的 `browser` 条件现在正确提供 ESM（`import`）和 CJS（`require`）子条件，确保 Jest 解析到浏览器实体模块的 CommonJS 版本。

  फिक्स: jsdom वातावरण में लाइब्रेरी का उपयोग करते समय Jest टेस्ट सुइट "Unexpected token 'export'" त्रुटि के साथ विफल हो रहे थे। package.json `imports` फ़ील्ड में `browser` कंडीशन अब सही ढंग से ESM (`import`) और CJS (`require`) सब-कंडीशन प्रदान करती है, जिससे Jest ब्राउज़र एंटिटी मॉड्यूल के CommonJS संस्करण को सही ढंग से रिज़ॉल्व करता है।

- 2432f0b: Fix: preserve camelCase attribute casing for all HTML/JSX tags, not just PascalCase components. This restores expected behavior where attributes like `userId` and `firstName` are no longer lowercased to `userid` and `firstname`.

  修复：为所有 HTML/JSX 标签保留 camelCase 属性大小写，而不仅仅是 PascalCase 组件。这恢复了预期行为，使得 `userId` 和 `firstName` 等属性不再被转换为小写的 `userid` 和 `firstname`。

  फिक्स: सभी HTML/JSX टैग के लिए camelCase एट्रिब्यूट केसिंग को संरक्षित करें, न कि केवल PascalCase कंपोनेंट के लिए। यह अपेक्षित व्यवहार को बहाल करता है जहां `userId` और `firstName` जैसे एट्रिब्यूट अब लोअरकेस `userid` और `firstname` में परिवर्तित नहीं होते हैं।

## 9.6.0

### Minor Changes

- a97e2bf: Add `optimizeForStreaming` option to suppress incomplete syntax during streaming. When enabled, incomplete inline code, links, emphasis, and other markdown syntax is hidden cleanly as characters arrive, preventing visual artifacts and flickering. Particularly useful for AI-powered streaming applications.

## 9.5.7

### Patch Changes

- 4252da4: Fixed inconsistent spacing between list item nodes when continuation lines have indentation equal to the nested list marker. Previously, text nodes in list items were being concatenated without newlines when continuation lines matched the list's base indentation, causing missing line breaks in the rendered output.

## 9.5.6

### Patch Changes

- 13bdaf7: Fixed HTML tags with attributes spanning multiple lines being incorrectly parsed.

  Previously, HTML tags with attributes on separate lines (like `<dl-custom\n  data-variant='horizontalTable'\n>`) would have their attributes incorrectly parsed, sometimes causing duplicate tags or missing attribute values. This fix ensures that newlines between HTML attributes are properly recognized as whitespace separators.

  修复了属性跨多行的 HTML 标签解析不正确的问题。

  之前，属性位于单独行上的 HTML 标签（如 `<dl-custom\n  data-variant='horizontalTable'\n>`）的属性解析不正确，有时会导致重复的标签或缺失属性值。此修复确保 HTML 属性之间的换行符被正确识别为空白分隔符。

  कई पंक्तियों में फैले एट्रिब्यूट वाले HTML टैग्स के गलत पार्सिंग को ठीक किया।

  पहले, अलग-अलग पंक्तियों पर एट्रिब्यूट वाले HTML टैग्स (जैसे `<dl-custom\n  data-variant='horizontalTable'\n>`) के एट्रिब्यूट गलत तरीके से पार्स होते थे, जिससे कभी-कभी डुप्लिकेट टैग्स या गायब एट्रिब्यूट वैल्यू होते थे। यह फिक्स सुनिश्चित करता है कि HTML एट्रिब्यूट के बीच न्यूलाइन को व्हाइटस्पेस सेपरेटर के रूप में सही ढंग से पहचाना जाता है।

- 13bdaf7: The `text` field in HTML AST nodes now contains cleaned inner content without opening/closing tags. Use `rawText` for full raw HTML. This affects custom `renderRule` implementations that rely on the `text` field.

  HTML AST 节点中的 `text` 字段现在包含不带开/闭标签的清理后内容。使用 `rawText` 获取完整原始 HTML。这会影响依赖 `text` 字段的自定义 `renderRule` 实现。

  HTML AST नोड्स में `text` फ़ील्ड अब ओपनिंग/क्लोज़िंग टैग्स के बिना साफ़ इनर कंटेंट रखता है। पूर्ण raw HTML के लिए `rawText` का उपयोग करें। यह उन कस्टम `renderRule` कार्यान्वयनों को प्रभावित करता है जो `text` फ़ील्ड पर निर्भर हैं।

## 9.5.5

### Patch Changes

- 76b7f12: Fix multi-line HTML tag attribute parsing (#781)

  HTML tags with attributes spanning multiple lines were not having their attributes correctly parsed into the AST. This caused custom elements with multi-line `data-*` attributes to have empty `attrs` objects, and the React compiler would then duplicate the opening tag when rendering.

  This fix ensures:
  - Attributes are correctly parsed for type 7 HTML blocks with newlines in the opening tag
  - The React compiler uses the parsed `children` array instead of re-parsing `rawText` when attributes are already parsed

  ***

  修复多行 HTML 标签属性解析问题（#781）

  具有跨多行属性的 HTML 标签没有正确将其属性解析到 AST 中。这导致具有多行 `data-*` 属性的自定义元素具有空的 `attrs` 对象，然后 React 编译器在渲染时会重复开始标签。

  此修复确保：
  - 对于开始标签中包含换行符的类型 7 HTML 块，属性被正确解析
  - 当属性已被解析时，React 编译器使用已解析的 `children` 数组而不是重新解析 `rawText`

  ***

  बहु-पंक्ति HTML टैग विशेषता पार्सिंग ठीक करें (#781)

  कई पंक्तियों में फैले विशेषताओं वाले HTML टैग अपनी विशेषताओं को AST में सही ढंग से पार्स नहीं कर रहे थे। इससे बहु-पंक्ति `data-*` विशेषताओं वाले कस्टम तत्वों में खाली `attrs` ऑब्जेक्ट थे, और फिर React कंपाइलर रेंडरिंग करते समय आरंभिक टैग को दोहरा देता था।

  यह सुधार सुनिश्चित करता है:
  - आरंभिक टैग में न्यूलाइन वाले टाइप 7 HTML ब्लॉक के लिए विशेषताएं सही ढंग से पार्स की जाती हैं
  - जब विशेषताएं पहले से पार्स हो चुकी हों तो React कंपाइलर `rawText` को दोबारा पार्स करने के बजाय पार्स किए गए `children` सरणी का उपयोग करता है

## 9.5.4

### Patch Changes

- 7f724a6: Fix HTML block parsing for sibling elements like `<dt>`/`<dd>` without blank lines between them.

  Type 6 HTML blocks (such as `<dl>`, `<dt>`, `<dd>`, `<table>`, `<tr>`, `<td>`) were incorrectly parsed when sibling elements appeared without blank lines between them—the first element would consume all subsequent siblings as its content instead of treating them as separate elements.

  This fix adds nesting-aware closing tag detection that properly handles:
  - Nested elements with the same tag name (e.g., `<div><div></div></div>`)
  - Sibling elements at the same level (e.g., `<dt></dt><dd></dd>`)
  - CommonMark compliance for HTML blocks that should extend to blank lines

  ***

  修复了没有空行分隔的兄弟 HTML 元素（如 `<dt>`/`<dd>`）的块解析问题。

  类型 6 HTML 块（如 `<dl>`、`<dt>`、`<dd>`、`<table>`、`<tr>`、`<td>`）在兄弟元素之间没有空行时解析错误——第一个元素会将所有后续兄弟元素作为其内容，而不是将它们视为单独的元素。

  此修复添加了具有嵌套感知的关闭标签检测，正确处理：
  - 同名标签的嵌套元素（例如 `<div><div></div></div>`）
  - 同级的兄弟元素（例如 `<dt></dt><dd></dd>`）
  - 应延续到空行的 HTML 块的 CommonMark 合规性

  ***

  रिक्त पंक्तियों के बिना भाई HTML तत्वों (जैसे `<dt>`/`<dd>`) के लिए HTML ब्लॉक पार्सिंग को ठीक किया।

  टाइप 6 HTML ब्लॉक (जैसे `<dl>`, `<dt>`, `<dd>`, `<table>`, `<tr>`, `<td>`) गलत तरीके से पार्स हो रहे थे जब भाई तत्व बिना रिक्त पंक्तियों के दिखाई देते थे—पहला तत्व सभी अनुवर्ती भाई तत्वों को अपनी सामग्री के रूप में शामिल कर लेता था, उन्हें अलग तत्वों के रूप में मानने के बजाय।

  यह सुधार नेस्टिंग-जागरूक क्लोजिंग टैग पहचान जोड़ता है जो सही ढंग से संभालता है:
  - समान टैग नाम वाले नेस्टेड तत्व (उदाहरण: `<div><div></div></div>`)
  - समान स्तर पर भाई तत्व (उदाहरण: `<dt></dt><dd></dd>`)
  - HTML ब्लॉक के लिए CommonMark अनुपालन जो रिक्त पंक्तियों तक विस्तारित होने चाहिए

- 58010ce: Fix duplicate opening tags for HTML elements with multi-line attributes (#781)

  HTML tags with attributes spanning multiple lines (like custom elements with `data-*` attributes on separate lines) no longer produce duplicate opening tags in the output. This restores the expected behavior for custom HTML elements used with component overrides.

  ***

  修复多行属性的 HTML 元素产生重复开始标签的问题（#781）

  具有跨多行属性的 HTML 标签（例如在不同行上具有 `data-*` 属性的自定义元素）不再在输出中产生重复的开始标签。这恢复了与组件覆盖一起使用的自定义 HTML 元素的预期行为。

  ***

  बहु-पंक्ति विशेषताओं वाले HTML तत्वों के लिए दोहरे आरंभिक टैग ठीक करें (#781)

  कई पंक्तियों में फैली विशेषताओं वाले HTML टैग (जैसे अलग-अलग पंक्तियों पर `data-*` विशेषताओं वाले कस्टम तत्व) अब आउटपुट में दोहरे आरंभिक टैग उत्पन्न नहीं करते। यह कंपोनेंट ओवरराइड के साथ उपयोग किए जाने वाले कस्टम HTML तत्वों के अपेक्षित व्यवहार को पुनर्स्थापित करता है।

- 3e25913: Fix fenced code blocks consuming nested code block openings as content.

  When a fenced code block with a language (e.g., ` ```markdown`) encountered another code block opening with a language (e.g., ` ```python`) inside it, the inner opening was incorrectly treated as content instead of being recognized as a new block. Now, fence lines with a language immediately following (no space between fence and language) are recognized as new block openings that implicitly close the previous block.

  This matches behavior of other markdown renderers like GitHub and VSCode. Lines like ` ``` aaa` (with space before info string) remain treated as content per CommonMark spec.

  ***

  修复了围栏代码块将嵌套代码块开头作为内容消费的问题。

  当带有语言的围栏代码块（例如 ` ```markdown`）内部遇到另一个带语言的代码块开头（例如 ` ```python`）时，内部开头被错误地视为内容，而不是被识别为新块。现在，语言紧随其后（围栏和语言之间没有空格）的围栏行被识别为隐式关闭前一个块的新块开头。

  这与 GitHub 和 VSCode 等其他 markdown 渲染器的行为一致。按照 CommonMark 规范，像 ` ``` aaa`（信息字符串前有空格）这样的行仍被视为内容。

  ***

  फेंस्ड कोड ब्लॉक्स द्वारा नेस्टेड कोड ब्लॉक ओपनिंग को सामग्री के रूप में उपभोग करने की समस्या को ठीक किया।

  जब भाषा वाला फेंस्ड कोड ब्लॉक (जैसे ` ```markdown`) के अंदर भाषा वाला दूसरा कोड ब्लॉक ओपनिंग (जैसे ` ```python`) आता था, तो आंतरिक ओपनिंग को नए ब्लॉक के रूप में पहचानने के बजाय गलती से सामग्री के रूप में माना जाता था। अब, भाषा तुरंत बाद आने वाली (फेंस और भाषा के बीच कोई स्पेस नहीं) फेंस लाइनें नए ब्लॉक ओपनिंग के रूप में पहचानी जाती हैं जो पिछले ब्लॉक को निहित रूप से बंद करती हैं।

  यह GitHub और VSCode जैसे अन्य markdown रेंडरर के व्यवहार से मेल खाता है। CommonMark स्पेक के अनुसार ` ``` aaa` (इन्फो स्ट्रिंग से पहले स्पेस) जैसी लाइनें अभी भी सामग्री के रूप में मानी जाती हैं।

## 9.5.3

### Patch Changes

- 8528325: Add CommonMark-compliant text normalization for null bytes and BOM

  Per CommonMark security specification, null bytes (U+0000) are now replaced with the replacement character (U+FFFD) instead of passing through unchanged. Additionally, the Byte Order Mark (U+FEFF) is now stripped when it appears at the start of a document, as specified in the CommonMark spec.

  These changes improve spec compliance and security. Most documents are unaffected due to fast-path optimization that skips processing when no special characters are present.

## 9.5.2

### Patch Changes

- 282affe: Fix lists and other markdown structures not rendering correctly when input has CRLF line endings.
- 282affe: Fix paragraph after nested list being incorrectly absorbed into the nested list item when followed by a blank line.

## 9.5.1

### Patch Changes

- fa21868: Add Chinese (Mandarin) JSDoc documentation to all public APIs. All exported functions, types, interfaces, and components now include bilingual documentation using the `@lang zh` tag for Simplified Chinese translations, improving developer experience for Chinese-speaking users.
- fa21868: Add Hindi (हिन्दी) language support for internationalization. Includes full translations of documentation (README, markdown spec, GFM spec, interactive demo template), UI strings, and JSDoc translations for all public APIs using the `@lang hi` tag. Hindi is now the third supported language after English and Mandarin Chinese, following global speaker rankings (Ethnologue 2025).
- 897c4c2: Automatic browser bundle optimization via conditional exports. Browser builds now automatically use DOM-based entity decoding (`textarea.innerHTML`) instead of shipping the full ~11KB entity lookup table, reducing gzipped bundle size by ~11KB.

  This optimization is automatic for bundlers that support the `imports` field with `browser` condition (Webpack 5+, Vite, esbuild, Rollup, Parcel). No configuration required.

  Server-side/Node.js builds retain the full O(1) entity lookup table for maximum performance.

  This feature uses the [`imports` field](https://nodejs.org/api/packages.html#subpath-imports) in package.json. All modern bundlers support this field (Webpack 5+, Vite, esbuild, Rollup, Parcel).

## 9.5.0

### Minor Changes

- 7605d88: Add React Server Components (RSC) support with automatic environment detection.

  The `Markdown` component now seamlessly works in both RSC and client-side React environments without requiring 'use client' directives. The component automatically detects hook availability and adapts its behavior accordingly:
  - In RSC environments: Uses direct compilation without hooks for optimal server performance
  - In client environments: Uses hooks and memoization for optimal client performance
  - `MarkdownProvider` and `MarkdownContext` gracefully become no-ops in RSC environments
  - Maintains identical output and API in both contexts
  - Zero breaking changes for existing users

  This enables better bundle splitting and SSR performance by allowing markdown rendering to happen on the server when possible.

### Patch Changes

- d2075d2: Fix hard line breaks (two trailing spaces) inside list items not being converted to `<br/>`.

  In v9, hard line breaks inside list items were being lost because the first line content and continuation lines were being parsed separately, causing the trailing spaces before the newline to be stripped before the hard break could be detected.

  The fix ensures that for tight list items (without blank lines), simple text continuation lines are collected and concatenated with the first line content before parsing. This preserves the trailing spaces + newline sequence that triggers hard break detection.

  This fix also handles hard line breaks inside blockquotes that are nested within list items, ensuring the blockquote continuation lines are properly collected together.

  Fixes #766.

## 9.4.2

### Patch Changes

- 775b4bf: Expose `parser` and `RuleType` from the markdown entry point as documented.

## 9.4.1

### Patch Changes

- 7ee8a22: Ensure `renderRule` always executes before any other rendering code across all renderers. The `renderRule` function now has full control over node rendering, including normally-skipped nodes like `ref`, `footnote`, and `frontmatter`. Additionally, `renderChildren` in the markdown renderer now invokes `renderRule` for recursively rendered child nodes, ensuring consistent behavior when customizing rendering logic.
- 7ee8a22: HTML blocks are now always fully parsed into the AST `children` property, even when marked as `verbatim`. The `verbatim` flag now acts as a rendering hint rather than a parsing control. Default renderers still use `rawText` for verbatim blocks (maintaining CommonMark compliance), but `renderRule` implementations can now access the fully parsed AST in `children` for all HTML blocks. The `noInnerParse` property has been replaced with `verbatim` for clarity.
- 7ee8a22: Add `HTMLNode.rawText` field for consistency with `rawAttrs`. The `rawText` field contains the raw text content for verbatim HTML blocks, while `children` contains the parsed AST. The `text` property is now deprecated and will be removed in a future major version. Both fields are set to the same value for backward compatibility.

## 9.4.0

### Minor Changes

- c1be885: Added context providers and memoization to all major renderers for better developer experience and performance.

  **React:**
  - `MarkdownContext` - React context for default options
  - `MarkdownProvider` - Provider component to avoid prop-drilling
  - `useMemo` - 3-stage memoization (options, content, JSX)

  **React Native:**
  - `MarkdownContext` - React context for default options
  - `MarkdownProvider` - Provider component to avoid prop-drilling
  - `useMemo` - 3-stage memoization (options, content, JSX)

  **Vue:**
  - `MarkdownOptionsKey` - InjectionKey for provide/inject pattern
  - `MarkdownProvider` - Provider component using Vue's provide
  - `computed` - Reactive memoization for options, content, and JSX

  **Benefits:**
  1. **Avoid prop-drilling** - Set options once at the top level:

  ```tsx
  <MarkdownProvider options={commonOptions}>
    <App>
      <Markdown>...</Markdown>
      <Markdown>...</Markdown>
    </App>
  </MarkdownProvider>
  ```

  2. **Performance optimization** - Content is only parsed when it actually changes, not on every render
  3. **Fully backwards compatible** - Existing usage works unchanged, providers are optional

  **Example:**

  ```tsx
  import { MarkdownProvider } from 'markdown-to-jsx/react'

  function App() {
    return (
      <MarkdownProvider options={{ wrapper: 'article', tagfilter: true }}>
        <Markdown># Page 1</Markdown>
        <Markdown># Page 2</Markdown>
        {/* Both inherit options from provider */}
      </MarkdownProvider>
    )
  }
  ```

- ef8a002: Added opt-in `options.evalUnserializableExpressions` to eval function expressions and other unserializable JSX props from trusted markdown sources.

  **⚠️ SECURITY WARNING: STRONGLY DISCOURAGED FOR USER INPUTS**

  This option uses `eval()` and should ONLY be used with completely trusted markdown sources (e.g., your own documentation). Never enable this for user-submitted content.

  **Usage:**

  ```tsx
  // For trusted sources only
  const markdown = `
  <Button onPress={() => alert('clicked!')} />
  <ApiEndpoint url={process.env.API_URL} />
  `

  parser(markdown, { evalUnserializableExpressions: true })

  // Components receive:
  // - onPress: actual function () => alert('clicked!')
  // - url: the value of process.env.API_URL from your environment
  // Without this option, these would be strings "() => alert('clicked!')" and "process.env.API_URL"
  ```

  **Safer alternative:** Use `renderRule` to handle stringified expressions on a case-by-case basis with your own validation and allowlists.

  See the README for detailed security considerations and safe alternatives.

- ef8a002: JSX prop values are now intelligently parsed instead of always being strings:
  - **Arrays and objects** are parsed via `JSON.parse()`: `data={[1, 2, 3]}` → `attrs.data = [1, 2, 3]`
  - **Booleans** are parsed: `enabled={true}` → `attrs.enabled = true`
  - **Functions** are kept as strings for security: `onClick={() => ...}` → `attrs.onClick = "() => ..."`
  - **Complex expressions** are kept as strings: `value={someVar}` → `attrs.value = "someVar"`

  The original raw attribute string is preserved in the `rawAttrs` field.

  **Benefits:**
  - Type-safe access to structured data without manual parsing
  - Backwards compatible - check types before using
  - Secure by default - functions remain as strings

  **Example:**

  <!-- prettier-ignore -->
  ```tsx
  // In markdown:
  <ApiTable
    rows={[
      ['Name', 'Value'],
      ['foo', 'bar'],
    ]}
  />
  
  // In your component:
  const ApiTable = ({ rows }) => {
    // rows is already an array, no JSON.parse needed!
    return <table>...</table>
  }
  
  // For backwards compatibility:
  const rows =
    typeof props.rows === 'string' ? JSON.parse(props.rows) : props.rows
  ```

  **Security:** Functions remain as strings by default. Use `renderRule` for case-by-case handling, or see the new `options.evalUnserializableExpressions` feature for opt-in eval (not recommended for user inputs).

### Patch Changes

- ef8a002: JSX components with double-newlines (blank lines) between opening and closing tags now properly nest children instead of creating sibling nodes. This fixes incorrect AST structure for JSX/MDX content.

  **Before:**

  <!-- prettier-ignore -->
  ```jsx
  <Figure>
  
    <div>content</div>
  
  </Figure>
  ```

  Parsed as 3 siblings: `<Figure>`, `<div>`, `</Figure>`

  **After:**

  Parsed as parent-child: `<Figure>` contains `<div>` as a child

  This was a bug where the parser incorrectly treated JSX components as siblings when double-newlines were present between the tags. The fix ensures proper parent-child relationships match expected JSX/MDX semantics.

## 9.3.5

### Patch Changes

- 08dfe8a: Fix regression: Tables within list items are now properly parsed.

## 9.3.4

### Patch Changes

- c5b6259: Fixed URIError when parsing HTML attributes containing the % character (e.g., `width="100%"`). The parser now gracefully handles invalid URI encodings in attribute values instead of throwing an error.

## 9.3.3

### Patch Changes

- 7ac3408: Restore angle-bracket autolinks when raw HTML parsing is disabled so `<https://...>` still renders as links
- 7ac3408: Improve autolink parsing: stricter angle controls, domain underscore validation, and added coverage for mailto labels and raw-HTML-disabled cases.

## 9.3.2

### Patch Changes

- a84c300: Ensure Solid renderer uses Solid's hyperscript runtime so JSX returns real elements instead of `[object Object]` placeholders

## 9.3.1

### Patch Changes

- c1b0ea2: Fix unintended node-specific code from entering browser bundles by changing build target from 'node' to 'browser'

## 9.3.0

### Minor Changes

- a482de6: Add SolidJS integration with full JSX output support. Includes compiler, parser, astToJSX, and Markdown component with reactive support via signals/accessors.
- f9a8fca: Add Vue.js 3+ integration. Includes `compiler`, `parser`, `astToJSX`, and `Markdown` component. Vue uses standard HTML attributes (class, not className) with minimal attribute mapping (only 'for' -> 'htmlFor').

### Patch Changes

- 2bb3f2b: Fix AST and options mutation bugs that could cause unexpected side effects when using memoization or reusing objects across multiple compiler calls.

## 9.2.0

### Minor Changes

- 88d4b1f: Add comprehensive React Native support with new `/native` export. Includes:
  - **React Native Component Mapping**: Enhanced HTML tag to React Native component mapping with semantic support for `img` → `Image`, block elements (`div`, `section`, `article`, `blockquote`, `ul`, `ol`, `li`, `table`, etc.) → `View`, and inline elements → `Text`
  - **Link Handling**: Native link support with `onLinkPress` and `onLinkLongPress` callbacks, defaulting to `Linking.openURL`
  - **Styling System**: Complete `NativeStyleKey` type system with styles for all markdown elements and HTML semantic tags
  - **Component Overrides**: Full support for overriding default components with custom React Native components and props
  - **Accessibility**: Built-in accessibility support with `accessibilityLabel` for images and proper link handling
  - **Type Safety**: Comprehensive TypeScript definitions with `NativeOptions` and `NativeStyleKey` types
  - **Performance**: Optimized rendering with proper React Native best practices and component lifecycle

  React Native is an optional peer dependency, making this a zero-dependency addition for existing users.

## 9.1.2

### Patch Changes

- f93214a: Fix infinite recursion when using `forceBlock: true` with empty unclosed HTML tags

  When `React.createElement(Markdown, {options: {forceBlock: true}}, '<var>')` was called with an empty unclosed tag, it would cause infinite recursion. The parser would set the `text` field to the opening tag itself (e.g., `<var>`), which would then be parsed again in the rendering phase, causing recursion.

  This fix adds detection in `createVerbatimHTMLBlock` to detect when `forceBlock` is used and the text contains just the opening tag (empty unclosed tag), rendering it as an empty element to prevent recursion.

## 9.1.1

### Patch Changes

- 733f10e: Fix lazy continuation lines for list items when continuation text appears at base indentation without a blank line. Previously, continuation text was incorrectly appended inline to the list item. Now both the existing inline content and the continuation text are properly wrapped in separate paragraphs.

## 9.1.0

### Minor Changes

- 0ba757d: Add `preserveFrontmatter` option to control whether YAML frontmatter is rendered in the output. When set to `true`, frontmatter is rendered as a `<pre>` element in HTML/JSX output. For markdown-to-markdown compilation, frontmatter is preserved by default but can be excluded with `preserveFrontmatter: false`.

  | Compiler Type            | Default Behavior            | When `preserveFrontmatter: true` | When `preserveFrontmatter: false` |
  | ------------------------ | --------------------------- | -------------------------------- | --------------------------------- |
  | **React/HTML**           | ❌ Don't render frontmatter | ✅ Render as `<pre>` element     | ❌ Don't render frontmatter       |
  | **Markdown-to-Markdown** | ✅ Preserve frontmatter     | ✅ Preserve frontmatter          | ❌ Exclude frontmatter            |

### Patch Changes

- f945132: Fix lazy continuation lines for list items when continuation text appears at base indentation without a blank line before it. Previously, such lines were incorrectly parsed as separate paragraphs instead of being appended to the list item content.
- 36ef089: yWork around a bundling bug with exporting TypeScript namespaces directly. Bonus: MarkdownToJSX is now declared ambiently so you may not need to import it.

## 9.0.0

### Major Changes

- 1ce83eb: Complete GFM+CommonMark specification compliance
  - **Full CommonMark compliance**: All 652 official test cases now pass
  - **Verified GFM extensions**: Tables, task lists, strikethrough, autolinks with spec compliance
  - **Tag filtering**: Default filtering of dangerous HTML tags (`<script>`, `<iframe>`, etc.) in both HTML string output and React JSX output
  - **URL sanitization**: Protection against `javascript:`, `vbscript:`, and malicious `data:` URLs

  Default filtering of dangerous HTML tags:
  - `<script>`, `<iframe>`, `<object>`, `<embed>`
  - `<title>`, `<textarea>`, `<style>`, `<xmp>`
  - `<plaintext>`, `<noembed>`, `<noframes>`

  ## ⚠️ Breaking Changes
  - **Tagfilter enabled by default**: Dangerous HTML tags are now escaped by default in both HTML and React output
  - **Inline formatting restrictions**: Inline formatting delimiters (emphasis, bold, strikethrough, mark) can no longer span across newlines, per CommonMark specification

  ## 📋 Migration

  ### Tagfilter Migration

  No changes necessary in most cases, but if you need to render potentially dangerous HTML tags, you can disable tag filtering:

  ```ts
  compiler(markdown, { tagfilter: false })
  ```

  ### Inline Formatting Migration

  **Previous Behavior (Non-Compliant):**
  The library previously allowed inline formatting to span multiple lines:

  ```markdown
  _Hello
  World._
  ```

  This was parsed as a single `<em>` element containing the newline.

  **New Behavior (CommonMark Compliant):**
  Per CommonMark specification, inline formatting cannot span newlines. The above example is now parsed as literal underscores:

  ```markdown
  _Hello
  World._
  ```

  Renders as: `<p>_Hello World._</p>`

  **Impact:**
  - Single-line formatting still works: `*Hello World*` → `<em>Hello World</em>`
  - Multi-line formatting is now rejected: `*Hello\nWorld*` → literal asterisks
  - Affects all inline formatting: `*emphasis*`, `**bold**`, `~~strikethrough~~`, `==mark==`

  **Migration Options:**
  If you have markdown with multi-line inline formatting:
  1. Keep formatting on a single line: `*Hello World*`
  2. Use HTML tags: `<em>Hello\nWorld</em>`
  3. Accept that multi-line formatting renders as literal delimiters

  **Examples:**

  ```markdown
  # Works (single line)

  _This is emphasized_
  **This is bold**

  # No longer works (multi-line)

  _This is
  emphasized_
  **This is
  bold**

  # Renders as literal delimiters:

  <p>_This is
  emphasized_</p>
  <p>**This is
  bold**</p>

  # Workaround: Use HTML tags

  <em>This is
  emphasized</em>
  <strong>This is
  bold</strong>
  ```

- 1ce83eb: Remove internal type definitions and rename `MarkdownToJSX.RuleOutput` to `MarkdownToJSX.ASTRender`

  This change removes internal type definitions from the `MarkdownToJSX` namespace:
  - Removed `NestedParser` type
  - Removed `Parser` type
  - Removed `Rule` type
  - Removed `Rules` type
  - Renamed `RuleOutput` to `ASTRender` for clarity

  **Breaking changes:**

  If you are using the internal types directly:
  - Code referencing `MarkdownToJSX.NestedParser`, `MarkdownToJSX.Parser`, `MarkdownToJSX.Rule`, or `MarkdownToJSX.Rules` will need to be updated
  - The `renderRule` option in `MarkdownToJSX.Options` now uses `ASTRender` instead of `RuleOutput` for the `renderChildren` parameter type
  - `HTMLNode.children` type changed from `ReturnType<MarkdownToJSX.NestedParser>` to `ASTNode[]` (semantically equivalent, but requires updates if using the old type)

- 1ce83eb: Remove `options.namedCodesToUnicode`. The library now encodes the full HTML entity list by default per CommonMark specification requirements.

  **Migration:**

  If you were using `options.namedCodesToUnicode` to add custom entity mappings, you can remove the option entirely as all specified HTML entities are now supported automatically.

- 1ce83eb: Drop support for React versions less than 16
  - Update peer dependency requirement from `>= 0.14.0` to `>= 16.0.0`
  - Remove legacy code that wrapped string children in `<span>` elements for React < 16 compatibility
  - Directly return single children and null without wrapper elements

- 1ce83eb: Upgrade to React 19 types
  - Update to `@types/react@^19.2.2` and `@types/react-dom@^19.2.2`
  - Use `React.JSX.*` namespace instead of `JSX.*` for React 19 compatibility

### Minor Changes

- 1ce83eb: Adopt CommonMark-compliant class naming for code blocks

  Code blocks now use both the `language-` and `lang-` class name prefixes to match the CommonMark specification for compatibility.

  ### Before

  ````md
  ```js
  console.log('hello')
  ```
  ````

  Generated:

  ```html
  <pre><code class="lang-js">console.log('hello');</code></pre>
  ```

  ### After

  ````md
  ```js
  console.log('hello')
  ```
  ````

  Generated:

  ```html
  <pre><code class="language-js lang-js">console.log('hello');</code></pre>
  ```

- 1ce83eb: Separate JSX renderer from compiler and add new entry points

  ## New Features
  - **New `parser` function**: Low-level API that returns AST nodes. Exported from main entry point and all sub-entry points.

    ```tsx
    import { parser } from 'markdown-to-jsx'
    const source = '# Hello world'
    const ast = parser(source)
    ```

  - **New `/react` entry point**: React-specific entry point that exports compiler, Markdown component, parser, types, and utils.

    ```tsx
    import Markdown, { astToJSX, compiler, parser } from 'markdown-to-jsx/react'

    const source = '# Hello world'
    const oneStepJSX = compiler(source)
    const twoStepJSX = astToJSX(parser(source))

    function App() {
      return <Markdown children={source} />
      // or
      // return <Markdown>{source}</Markdown>
    }
    ```

  - **New `/html` entry point**: HTML string output entry point that exports html function, parser, types, and utils.

    ```tsx
    import { astToHTML, compiler, parser } from 'markdown-to-jsx/html'
    const source = '# Hello world'
    const oneStepHTML = compiler(source)
    const twoStepHTML = astToHTML(parser(source))
    ```

  - **New `/markdown` entry point**: Useful for situations where editing of the markdown is desired without resorting to gnarly regex-based parsing.
    ```tsx
    import { astToMarkdown, compiler, parser } from 'markdown-to-jsx/markdown'
    const source = '# Hello world'
    const oneStepMarkdown = compiler(source)
    const twoStepMarkdown = astToMarkdown(parser(source))
    ```

  ## Deprecations

  React code in the main entry point `markdown-to-jsx` is deprecated and will be removed in a future major release. In v10, the main entry point will only export the parser function, the types, and any exposed utility functions.

  ## Migration
  - For React-specific usage, switch imports to `markdown-to-jsx/react`
  - For HTML output, use `markdown-to-jsx/html` entry point
  - Use `parser()` for direct acces to AST

## 8.0.0

### Major Changes

- 450d2bb: Added `ast` option to compiler to expose the parsed AST directly. When `ast: true`, the compiler returns the AST structure (`ASTNode[]`) instead of rendered JSX.

  **Breaking Changes:**
  - The internal type `ParserResult` has been renamed to `ASTNode` for clarity. If you were accessing this type directly (e.g., via module augmentation or type manipulation), you'll need to update references from `MarkdownToJSX.ParserResult` to `MarkdownToJSX.ASTNode`.

  **First time the AST is accessible to users!** This enables:
  - AST manipulation and transformation before rendering
  - Custom rendering logic without parsing
  - Caching parsed AST for performance
  - Linting or validation of markdown structure

  **Usage:**

  ```typescript
  import { compiler } from 'markdown-to-jsx'
  import type { MarkdownToJSX } from 'markdown-to-jsx'

  // Get the AST structure
  const ast: MarkdownToJSX.ASTNode[] = compiler('# Hello world', {
    ast: true,
  })

  // Inspect/modify AST
  console.log(ast) // Array of parsed nodes

  // Render AST to JSX using createRenderer (not implemented yet)
  ```

  The AST format is `MarkdownToJSX.ASTNode[]`. When footnotes are present, the returned value will be an object with `ast` and `footnotes` properties instead of just the AST array.

- 3fa0c22: Refactored inline formatting parsing to eliminate ReDoS vulnerabilities and improve performance. The previous regex-based approach was susceptible to exponential backtracking on certain inputs and had several edge case bugs with nested formatting, escaped characters, and formatting inside links. The new implementation uses a custom iterative scanner that runs in O(n) time and is immune to ReDoS attacks.

  This also consolidates multiple formatting rule types into a single unified rule with boolean flags, reducing code duplication and bundle size. Performance has improved measurably on simple markdown strings:

  **Breaking Changes:**

  The following `RuleType` enum values have been removed and consolidated into a single `RuleType.textFormatted`:
  - `RuleType.textBolded`
  - `RuleType.textEmphasized`
  - `RuleType.textMarked`
  - `RuleType.textStrikethroughed`

  If you're using these rule types directly (e.g., for custom AST processing or overrides), you'll need to update your code to check for `RuleType.textFormatted` instead and inspect the node's boolean flags (`bold`, `italic`, `marked`, `strikethrough`) to determine which formatting is applied.

### Minor Changes

- a421067: fix: overhaul HTML block parsing to eliminate exponential backtracking

  Replaced the complex nested regex `HTML_BLOCK_ELEMENT_R` with an efficient iterative depth-counting algorithm that maintains O(n) complexity. The new implementation uses stateful regex matching with `lastIndex` to avoid exponential backtracking on nested HTML elements while preserving all existing functionality.

  **Performance improvements:**
  - Eliminates O(2^n) worst-case exponential backtracking
  - Linear O(n) time complexity regardless of nesting depth

### Patch Changes

- e6b1e14: Fix renderer crash on extremely deeply nested markdown content

  Previously, rendering markdown with extremely deeply nested content (e.g., thousands of nested bold markers like `****************...text...****************`) would cause a stack overflow crash. The renderer now gracefully handles such edge cases by falling back to plain text rendering instead of crashing.

  **Technical details:**
  - Added render depth tracking to prevent stack overflow
  - Graceful fallback at 2500 levels of nesting (way beyond normal usage)
  - Try/catch safety net as additional protection for unexpected errors
  - Zero performance impact during normal operation
  - Prevents crashes while maintaining O(n) parsing complexity

  This fix ensures stability even with adversarial or malformed inputs while having no impact on normal markdown documents.

- fe95c02: Remove unnecessary wrapper when footnotes are present.

## 7.7.17

### Patch Changes

- acc11ad: Fix null children crashing app in production

  When `null` is passed as children to the `<Markdown>` component, it would previously crash the app in production. This fix handles this case by converting it to empty string.

  ### Usage Example

  Before this fix, the following code would crash in production:

  ```jsx
  <Markdown>{null}</Markdown>
  ```

  After this fix, this case is handled gracefully and renders nothing.

## 7.7.16

### Patch Changes

- 7e487bd: Fix the issue where YAML frontmatter in code blocks doesn't render properly.

  This is done by lowering the parsing priority of Setext headings to match ATX headings; both are now prioritized lower than code blocks.

## 7.7.15

### Patch Changes

- 8e4c270: Mark react as an optional peer dependency as when passing createElement, you don't need React

## 7.7.14

### Patch Changes

- 73d4398: Cut down on unnecessary matching operations by improving qualifiers. Also improved the matching speed of paragraphs, which led to a roughly 2x boost in throughput for larger input strings.

## 7.7.13

### Patch Changes

- da003e4: Fix exponential backtracking issue for unpaired inline delimiter sequences.

## 7.7.12

### Patch Changes

- 4351ef5: Adjust text parsing to not split on double spaces unless followed by a newline.
- 4351ef5: Special case detection of :shortcode: so the text processor doesn't break it into chunks, enables shortcode replacement via renderRule.

## 7.7.11

### Patch Changes

- 4a692dc: Fixes the issue where link text containing multiple nested brackets is not parsed correctly.

  Before: `[title[bracket1][bracket2]](url)` fails to parse as a link
  After: `[title[bracket1][bracket2]](url)` correctly parses as a link

## 7.7.10

### Patch Changes

- bf9dd3d: Unescape content intended for JSX attributes.

## 7.7.9

### Patch Changes

- 95dda3e: Avoid creating unnecessary paragraphs inside of HTML.
- 95dda3e: Fix HTML parser to avoid processing the inside of `<pre>` blocks.

## 7.7.8

### Patch Changes

- db378c7: Implement early short-circuit for rules to avoid expensive throwaway work.
- db378c7: Simpler fix that preserves existing performance.
- db378c7: Various low-hanging minor performance enhancements by doing less work.
- db378c7: Improve compression by inlining static RuleType entries when used in the codebase.

## 7.7.7

### Patch Changes

- 89c87e5: Handle spaces in text as a stop token to improve processing, also adapt paragraph detection to exclude non-atx compliant headings if that option is enabled.

  Fixes #680

## 7.7.6

### Patch Changes

- 654855b: Sanitize more attributes by default to help address XSS vectors.
- 7639c08: Improve splitting of style attributes.

## 7.7.5

### Patch Changes

- 0ddaabb: Remove unescaping of content inside fenced code blocks.
- 07b4280: Better handle exotic backtick scenarios for inline code blocks.
- 0dad192: Fix consecutive marked text.

## 7.7.4

### Patch Changes

- adc08c7: Further optimize the plain text splitting regex.
- c8bc5f3: Remove redundant detectors when processing paragraphs.
- d96a8d8: Replace some regexes with optimized functions to avoid polynomial time scenarios. Also fixes compatibility issues in some older browsers with the `trimEnd` API.
- 7be3d77: Optimize regexes and parsing to do less work.
- cf7693c: Rework inline code syntax handling, handle escaped characters in code blocks correctly so they render without the backslash.

## 7.7.3

### Patch Changes

- 8026103: Handle paragraph splitting better, fixes #641.
- 1ea00bb: Adjust table row parsing to better handle inline syntaxes and improve performance.

## 7.7.2

### Patch Changes

- 52a727c: Use `ReactNode` instead of `ReactChild` for React 19 compatibility
- 4fa87d8: Bump ws from 8.11.0 to 8.18.0

## 7.7.1

### Patch Changes

- 9d42449: Factor out unnecessary element cloning.
- 8920038: Remove use of explicit React.createElement.

## 7.7.0

### Minor Changes

- 20777bf: Add support for GFM alert-style blockquotes.

  ```md
  > [!Note]
  > This is a note-flavored alert blockquote. The "Note" text is injected as a `<header>` by
  > default and the blockquote can be styled via the injected class `markdown-alert-note`
  > for example.
  ```

### Patch Changes

- 5d7900b: Adjust type signature for `<Markdown>` component to allow for easier composition.
- 918b44b: Use newer `React.JSX.*` namespace instead of `JSX.*` for React 19 compatibility.
- 91a5948: Arbitrary HTML no longer punches out pipes when parsing rows. If you absolutely need a pipe character that isn't a table separator, either escape it or enclose it in backticks to trigger inline code handling.
- 23caecb: Drop encountered `ref` attributes when processing inline HTML, React doesn't handle it well.

## 7.6.2

### Patch Changes

- 0274445: Fix false detection of tables in some scenarios.
- 69f815e: Handle `class` attribute from arbitrary HTML properly to avoid React warnings.
- 857809a: Fenced code blocks are now tolerant to a missing closing sequence; this improves use in LLM scenarios where the code block markdown is being streamed into the editor in chunks.

## 7.6.1

### Patch Changes

- 87d8bd3: Handle `class` attribute from arbitrary HTML properly to avoid React warnings.

## 7.6.0

### Minor Changes

- 2281a4d: Add `options.disableAutoLink` to customize bare URL handling behavior.

  By default, bare URLs in the markdown document will be converted into an anchor tag. This behavior can be disabled if desired.

  ```jsx
  <Markdown options={{ disableAutoLink: true }}>
    The URL https://quantizor.dev will not be rendered as an anchor tag.
  </Markdown>

  // or

  compiler(
    'The URL https://quantizor.dev will not be rendered as an anchor tag.',
    { disableAutoLink: true }
  )

  // renders:

  <span>
    The URL https://quantizor.dev will not be rendered as an anchor tag.
  </span>
  ```

### Patch Changes

- fb3d716: Simplify handling of fallback scenario if a link reference is missing its corresponding footnote.

## 7.5.1

### Patch Changes

- b16f668: Fix issue with lookback cache resulting in false detection of lists inside lists in some scenarios
- 58b96d3: fix: handle empty HTML tags more consistently #597

## 7.5.0

### Minor Changes

- 62a16f3: Allow modifying HTML attribute sanitization when `options.sanitizer` is passed by the composer.

  By default a lightweight URL sanitizer function is provided to avoid common attack vectors that might be placed into the `href` of an anchor tag, for example. The sanitizer receives the input, the HTML tag being targeted, and the attribute name. The original function is available as a library export called `sanitizer`.

  This can be overridden and replaced with a custom sanitizer if desired via `options.sanitizer`:

  ```jsx
  // sanitizer in this situation would receive:
  // ('javascript:alert("foo")', 'a', 'href')

  ;<Markdown options={{ sanitizer: (value, tag, attribute) => value }}>
    {`[foo](javascript:alert("foo"))`}
  </Markdown>

  // or

  compiler('[foo](javascript:alert("foo"))', {
    sanitizer: (value, tag, attribute) => value,
  })
  ```

### Patch Changes

- 553a175: Replace RuleType enum with an object

## 7.4.7

### Patch Changes

- 7603248: Fix parsing isolation of individual table cells.
- f9328cc: Improved block html detection regex to handle certain edge cases that cause extreme slowness. Thank you @devbrains-com for the basis for this fix 🤝

## 7.4.6

### Patch Changes

- a9e5276: Browsers assign element with `id` to the global scope using the value as the variable name. E.g.: `<h1 id="analytics">` can be referenced via `window.analytics`.
  This can be a problem when a name conflict happens. For instance, pages that expect `analytics.push()` to be a function will stop working if the an element with an `id` of `analytics` exists in the page.

  In this change, we export the `slugify` function so that users can easily augment it.
  This can be used to avoid variable name conflicts by giving the element a different `id`.

  ```js
  import { slugify } from 'markdown-to-jsx';

  options={{
    slugify: str => {
      let result = slugify(str)

      return result ? '-' + str : result;
    }
  }}
  ```

## 7.4.5

### Patch Changes

- f5a0079: fix: double newline between consecutive blockquote syntax creates separate blockquotes

  Previously, for consecutive blockquotes they were rendered as one:

  **Input**

  ```md
  > Block A.1
  > Block A.2

  > Block B.1
  ```

  **Output**

  ```html
  <blockquote>
    <p>Block A.1</p>
    <p>Block A.2</p>
    <p>Block.B.1</p>
  </blockquote>
  ```

  This is not compliant with the [GFM spec](https://github.github.com/gfm/#block-quotes) which states that consecutive blocks should be created if there is a blank line between them.

## 7.4.4

### Patch Changes

- 8eb8a13: Handle newlines inside of HTML tags themselves (not just nested children.)
- c72dd31: Default `children` to an empty string if no content is passed.
- 4f752c8: Fix handling of deeply-nested HTML in some scenarios.
- 1486aa4: Handle extra brackets in links, thanks @zegl!
- 1486aa4: Allow a newline to appear within inline formatting like bold, emphasis, etc, thanks @austingreco!
- 1486aa4: Starting using changesets
- fd35402: Fix HTML block regex for custom component scenarios where a nested component shares the same prefix as the parent, e.g. Accordion vs AccordionItem.
- 1486aa4: Fix support for multi-line footnotes, thanks @zegl!
