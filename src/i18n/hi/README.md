[![npm version](https://badge.fury.io/js/markdown-to-jsx.svg)](https://badge.fury.io/js/markdown-to-jsx) [![downloads](https://badgen.net/npm/dy/markdown-to-jsx)](https://npm-stat.com/charts.html?package=markdown-to-jsx)

`markdown-to-jsx` JavaScript और TypeScript-आधारित परियोजनाओं के लिए एक gfm+commonmark अनुरूप markdown पार्सर और कंपाइलर टूलचेन है। यह अत्यधिक तेज़ है, वास्तविक समय की अंतरक्रियाशीलता के लिए पर्याप्त तेज़ी से बड़े दस्तावेज़ों को प्रोसेस करने में सक्षम है।

लाइब्रेरी की कुछ विशेष सुविधाएं:

- `dangerouslySetInnerHTML` के बिना मनमानी HTML समर्थित और उपयुक्त JSX प्रतिनिधित्व में पार्स की जाती है

- कंपाइलर और/या `<Markdown>` कंपोनेंट द्वारा रेंडर किए गए किसी भी HTML टैग को अतिरिक्त props शामिल करने या यहां तक कि पूरी तरह से एक अलग HTML प्रतिनिधित्व के लिए ओवरराइड किया जा सकता है।

- सभी GFM विशेष सिंटैक्स समर्थित हैं, जिनमें टेबल, टास्क लिस्ट, स्ट्राइकथ्रू, ऑटोलिंक, टैग फ़िल्टरिंग और बहुत कुछ शामिल है।

- [highlight.js](https://highlightjs.org/) समर्थन के साथ फ़ेंस्ड कोड ब्लॉक्स; highlight.js सेट अप करने के निर्देशों के लिए [सिंटैक्स हाइलाइटिंग](#syntax-highlighting) देखें।

<h2>विषय-सूची</h2>

<!-- TOC -->

- [अपग्रेडिंग](#upgrading)
  - [v8.x से v9.x तक](#from-v8x-to-v9x)
  - [v7.x से v8.x तक](#from-v7x-to-v8x)
- [इंस्टॉलेशन](#installation)
- [उपयोग](#usage)
  - [एंट्री पॉइंट्स](#entry-points)
    - [मुख्य](#main)
    - [React](#react)
      - [React Server Components (RSC)](#react-server-components-rsc)
    - [React Native](#react-native)
    - [SolidJS](#solidjs)
    - [Vue.js](#vuejs)
    - [HTML](#html)
    - [Markdown](#markdown)
  - [लाइब्रेरी विकल्प](#library-options)
    - [सभी विकल्प](#all-options)
    - [options.createElement](#optionscreateelement)
    - [options.forceWrapper](#optionsforcewrapper)
    - [options.overrides](#optionsoverrides)
    - [options.evalUnserializableExpressions](#optionsevalunserializableexpressions)
    - [options.ignoreHTMLBlocks](#optionsignorehtmlblocks)
    - [options.renderRule](#optionsrenderrule)
    - [options.sanitizer](#optionssanitizer)
    - [options.slugify](#optionsslugify)
    - [options.wrapper](#optionswrapper)
      - [अन्य उपयोगी रेसिपीज़](#other-useful-recipes)
    - [options.wrapperProps](#optionswrapperprops)
  - [सिंटैक्स हाइलाइटिंग](#syntax-highlighting)
  - [शॉर्टकोड्स को हैंडल करना](#handling-shortcodes)
  - [स्ट्रीमिंग Markdown](#स्ट्रीमिंग-markdown)
  - [Preact के साथ उपयोग](#usage-with-preact)
  - [AST संरचना](#ast-anatomy)
    - [नोड प्रकार](#node-types)
    - [उदाहरण AST संरचना](#example-ast-structure)
    - [टाइप जांच](#type-checking)
  - [समस्याएं](#gotchas)
- [परिवर्तन लॉग](#changelog)
- [दान करें](#donate)

<!-- /TOC -->

<h2 id="upgrading">अपग्रेडिंग</h2>

<h3 id="from-v8x-to-v9x">v8.x से v9.x तक</h3>

**ब्रेकिंग परिवर्तन:**

- **`ast` विकल्प हटाया गया**: `compiler()` पर `ast: true` विकल्प हटा दिया गया है। AST तक सीधे पहुंचने के लिए नए `parser()` फ़ंक्शन का उपयोग करें।

```typescript
/** v8 */ compiler('# नमस्कार दुनिया', { ast: true })
/** v9 */ parser('# नमस्कार दुनिया')
```

- **`namedCodesToUnicode` विकल्प हटाया गया**: `namedCodesToUnicode` विकल्प हटा दिया गया है। सभी नामित HTML एंटिटीज अब पूर्ण एंटिटी सूची के माध्यम से डिफ़ॉल्ट रूप से समर्थित हैं, इसलिए कस्टम एंटिटी मैपिंग की अब आवश्यकता नहीं है।

```typescript
/** v8 */ compiler('&le; symbol', { namedCodesToUnicode: { le: '\u2264' } })
/** v9 */ compiler('&le; symbol')
```

- **`tagfilter` डिफ़ॉल्ट रूप से सक्षम**: खतरनाक HTML टैग (`script`, `iframe`, `style`, `title`, `textarea`, `xmp`, `noembed`, `noframes`, `plaintext`) अब HTML स्ट्रिंग आउटपुट और React JSX आउटपुट दोनों में डिफ़ॉल्ट रूप से एस्केप किए जाते हैं। पहले ये टैग React आउटपुट में JSX एलिमेंट्स के रूप में रेंडर किए जाते थे।

```typescript
/** v8 */ टैग JSX एलिमेंट्स के रूप में रेंडर किए गए
/** v9 */ टैग डिफ़ॉल्ट रूप से एस्केप किए गए
compiler('<script>alert("xss")</script>') // <span>&lt;script&gt;</span>

/** पुराना व्यवहार पुनर्स्थापित करें */
compiler('<script>alert("xss")</script>', { tagfilter: false })
```

**नई सुविधाएं:**

- **नया `parser` फ़ंक्शन**: रेंडरिंग के बिना पार्स की गई AST तक सीधी पहुंच प्रदान करता है। यह AST नोड्स प्राप्त करने का अनुशंसित तरीका है।

- **नए एंट्री पॉइंट्स**: बेहतर ट्री-शेकिंग और चिंताओं के पृथक्करण के लिए React-विशिष्ट, HTML-विशिष्ट और markdown-विशिष्ट एंट्री पॉइंट्स अब उपलब्ध हैं।

```typescript
// React-विशिष्ट उपयोग
import Markdown, { compiler, parser } from 'markdown-to-jsx/react'

// HTML स्ट्रिंग आउटपुट
import { compiler, astToHTML, parser } from 'markdown-to-jsx/html'

// Markdown स्ट्रिंग आउटपुट (राउंड-ट्रिप कंपाइलेशन)
import { compiler, astToMarkdown, parser } from 'markdown-to-jsx/markdown'
```

**माइग्रेशन गाइड:**

1. **`compiler(..., { ast: true })` को `parser()` से बदलें**:

```typescript
/** v8 */ compiler(markdown, { ast: true })
/** v9 */ parser(markdown)
```

2. **React इम्पोर्ट्स को `/react` एंट्री पॉइंट पर माइग्रेट करें** (वैकल्पिक लेकिन अनुशंसित):

```typescript
/** लिगेसी */ import from 'markdown-to-jsx'
/** अनुशंसित */ import from 'markdown-to-jsx/react'
```

3. **`namedCodesToUnicode` विकल्प हटाएं**: सभी नामित HTML एंटिटीज अब स्वचालित रूप से समर्थित हैं, इसलिए आप किसी भी कस्टम एंटिटी मैपिंग को हटा सकते हैं।

```typescript
/** v8 */ compiler('&le; symbol', { namedCodesToUnicode: { le: '\u2264' } })
/** v9 */ compiler('&le; symbol')
```

**नोट:** मुख्य एंट्री पॉइंट (`markdown-to-jsx`) पिछड़ी संगतता के लिए काम करना जारी रखता है, लेकिन वहां React कोड को हटाना अप्रचलित किया गया है और भविष्य के प्रमुख रिलीज़ में हटा दिया जाएगा। React-विशिष्ट उपयोग के लिए `markdown-to-jsx/react` पर माइग्रेट करने पर विचार करें।

<details>
<summary>### पुराने माइग्रेशन गाइड</summary>

<h3 id="from-v7x-to-v8x">v7.x से v8.x तक</h3>

**ब्रेकिंग परिवर्तन:**

- टाइप `ParserResult` का नाम बदलकर `ASTNode` किया गया - यदि आप अपने कोड में `MarkdownToJSX.ParserResult` का उपयोग कर रहे थे, तो `MarkdownToJSX.ASTNode` में अपडेट करें

```typescript
/** v7 */ MarkdownToJSX.ParserResult[]
/** v8+ */ MarkdownToJSX.ASTNode[]
```

- एकाधिक `RuleType` enums को `RuleType.textFormatted` में समेकित किया गया - यदि आप `RuleType.textBolded`, `RuleType.textEmphasized`, `RuleType.textMarked`, या `RuleType.textStrikethroughed` की जांच कर रहे थे, तो `RuleType.textFormatted` की जांच करने और नोड के बूलियन फ़्लैग का निरीक्षण करने के लिए अपडेट करें:

```typescript
/** v7 */ RuleType.textBolded
/** v8+ */ RuleType.textFormatted && node.bold
```

</details>

<h2 id="installation">इंस्टॉलेशन</h2>

अपने पसंदीदा पैकेज मैनेजर के साथ `markdown-to-jsx` इंस्टॉल करें।

```shell
npm i markdown-to-jsx
```

<h2 id="usage">उपयोग</h2>

`markdown-to-jsx` आसान JSX संरचना के लिए डिफ़ॉल्ट रूप से एक React कंपोनेंट एक्सपोर्ट करता है:

ES6-शैली उपयोग\*:

```tsx
import Markdown from 'markdown-to-jsx'
import React from 'react'
import { render } from 'react-dom'

render(<Markdown># नमस्कार दुनिया!</Markdown>, document.body)

/*
    रेंडर करता है:

    <h1>नमस्कार दुनिया!</h1>
 */
```

\* **नोट: JSX बहुपंक्ति टेक्स्ट में नई लाइनों को मूल रूप से संरक्षित नहीं करता है। सामान्य तौर पर, JSX में सीधे markdown लिखना हतोत्साहित किया जाता है और अपनी सामग्री को अलग .md फ़ाइलों में रखना और उन्हें require करना एक बेहतर विचार है, शायद webpack के [raw-loader](https://github.com/webpack-contrib/raw-loader) का उपयोग करके।**

<h3 id="entry-points">एंट्री पॉइंट्स</h3>

`markdown-to-jsx` विभिन्न उपयोग के मामलों के लिए कई एंट्री पॉइंट्स प्रदान करता है:

<h4 id="main">मुख्य</h4>

लिगेसी डिफ़ॉल्ट एंट्री पॉइंट React कंपाइलर और कंपोनेंट सहित सब कुछ एक्सपोर्ट करता है:

```tsx
import Markdown, { compiler, parser } from 'markdown-to-jsx'
```

_इस एंट्री पॉइंट में React कोड अप्रचलित है और भविष्य के प्रमुख रिलीज़ में हटा दिया जाएगा, `markdown-to-jsx/react` पर माइग्रेट करें।_

<h4 id="react">React</h4>

React-विशिष्ट उपयोग के लिए, `/react` एंट्री पॉइंट से इम्पोर्ट करें:

```tsx
import Markdown, { compiler, parser, astToJSX } from 'markdown-to-jsx/react'

const jsxElement = compiler('# नमस्कार दुनिया')

function App() {
  return <Markdown children="# नमस्कार दुनिया" />
}

/** या parser + astToJSX का उपयोग करें */
const ast = parser('# नमस्कार दुनिया')
const jsxElement2 = astToJSX(ast)
```

<h5 id="react-server-components-rsc">React Server Components (RSC)</h5>

`Markdown` कंपोनेंट स्वचालित रूप से पता लगाता है कि यह React Server Component (RSC) या क्लाइंट वातावरण में चल रहा है और तदनुसार अनुकूलित होता है। किसी 'use client' निर्देश की आवश्यकता नहीं है।

**Server Component (RSC) उपयोग:**

```tsx
// Server Component - स्वचालित रूप से काम करता है
import Markdown from 'markdown-to-jsx/react'

export default async function Page() {
  const content = await fetchMarkdownContent()
  return <Markdown>{content}</Markdown>
}
```

**Client Component उपयोग:**

```tsx
// Client Component - भी स्वचालित रूप से काम करता है
'use client'
import Markdown from 'markdown-to-jsx/react'

export function ClientMarkdown({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>
}
```

**नोट्स:**

- `MarkdownProvider` और `MarkdownContext` केवल क्लाइंट के लिए हैं और RSC वातावरण में no-ops बन जाते हैं
- RSC रेंडरिंग क्लाइंट-साइड हाइड्रेशन से बचकर बेहतर प्रदर्शन प्रदान करती है
- कंपोनेंट दोनों वातावरणों में समान आउटपुट बनाए रखता है
- मौजूदा कोड के लिए किसी माइग्रेशन की आवश्यकता नहीं है

<h4 id="react-native">React Native</h4>

React Native उपयोग के लिए, `/native` एंट्री पॉइंट से इम्पोर्ट करें:

```tsx
import Markdown, { compiler, parser, astToNative } from 'markdown-to-jsx/native'
import { View, Text, StyleSheet, Linking } from 'react-native'

const nativeElement = compiler('# नमस्कार दुनिया', {
  styles: {
    heading1: { fontSize: 32, fontWeight: 'bold' },
    paragraph: { marginVertical: 8 },
    link: { color: 'blue', textDecorationLine: 'underline' },
  },
  onLinkPress: url => {
    Linking.openURL(url)
  },
})

const markdown = `# नमस्कार दुनिया

This is a [link](https://example.com) with **bold** and *italic* text.
`

function App() {
  return (
    <View>
      <Markdown
        children={markdown}
        options={{
          styles: StyleSheet.create({
            heading1: { fontSize: 32, fontWeight: 'bold' },
            paragraph: { marginVertical: 8 },
            link: { color: 'blue', textDecorationLine: 'underline' },
          }),
          onLinkPress: url => {
            Linking.openURL(url)
          },
        }}
      />
    </View>
  )
}
```

**React Native-विशिष्ट विकल्प:**

- `onLinkPress?: (url: string, title?: string) => void` - लिंक प्रेस के लिए कस्टम हैंडलर (डिफ़ॉल्ट `Linking.openURL`)
- `onLinkLongPress?: (url: string, title?: string) => void` - लिंक लॉन्ग प्रेस के लिए हैंडलर
- `styles?: Partial<Record<NativeStyleKey, StyleProp<ViewStyle | TextStyle | ImageStyle>>>` - प्रत्येक एलिमेंट प्रकार के लिए स्टाइल ओवरराइड्स
- `wrapperProps?: ViewProps | TextProps` - रैपर कंपोनेंट के लिए props (ब्लॉक के लिए डिफ़ॉल्ट `View`, इनलाइन के लिए `Text`)

**HTML टैग मैपिंग:**
HTML टैग स्वचालित रूप से React Native कंपोनेंट्स पर मैप किए जाते हैं:

- `<img>` → `Image` कंपोनेंट
- ब्लॉक एलिमेंट्स (`<div>`, `<section>`, `<article>`, `<blockquote>`, `<ul>`, `<ol>`, `<li>`, `<table>`, आदि) → `View` कंपोनेंट
- इनलाइन एलिमेंट्स (`<span>`, `<strong>`, `<em>`, `<a>`, आदि) → `Text` कंपोनेंट
- Type 1 ब्लॉक्स (`<pre>`, `<script>`, `<style>`, `<textarea>`) → `View` कंपोनेंट

**नोट:** बेहतर पहुंच और खोज योग्यता के लिए लिंक डिफ़ॉल्ट रूप से रेखांकित हैं। आप इसे `styles.link` विकल्प के माध्यम से ओवरराइड कर सकते हैं।

<h4 id="solidjs">SolidJS</h4>

SolidJS उपयोग के लिए, `/solid` एंट्री पॉइंट से इम्पोर्ट करें:

```tsx
import Markdown, {
  compiler,
  parser,
  astToJSX,
  MarkdownProvider,
} from 'markdown-to-jsx/solid'
import { createSignal } from 'solid-js'

// स्थिर सामग्री
const solidElement = compiler('# नमस्कार दुनिया')

function App() {
  return <Markdown children="# नमस्कार दुनिया" />
}

// रिएक्टिव सामग्री (सामग्री बदलने पर स्वचालित रूप से अपडेट होती है)
function ReactiveApp() {
  const [content, setContent] = createSignal('# नमस्कार दुनिया')
  return <Markdown>{content}</Markdown>
}

// या parser + astToJSX का उपयोग करें
const ast = parser('# नमस्कार दुनिया')
const solidElement2 = astToJSX(ast)

// डिफ़ॉल्ट विकल्पों के लिए कॉन्टेक्स्ट का उपयोग करें
function AppWithContext() {
  return (
    <MarkdownProvider options={{ sanitizer: customSanitizer }}>
      <Markdown># Content</Markdown>
    </MarkdownProvider>
  )
}
```

**SolidJS-विशिष्ट सुविधाएं:**

- **रिएक्टिव सामग्री**: `Markdown` कंपोनेंट markdown सामग्री बदलने पर स्वचालित अपडेट के लिए signals/accessors स्वीकार करता है
- **मेमोइज़ेशन**: इष्टतम प्रदर्शन के लिए AST पार्सिंग स्वचालित रूप से मेमोइज़ की जाती है
- **Context API**: डिफ़ॉल्ट विकल्प प्रदान करने और prop drilling से बचने के लिए `MarkdownProvider` का उपयोग करें

<h4 id="vuejs">Vue.js</h4>

Vue.js 3 उपयोग के लिए, `/vue` एंट्री पॉइंट से इम्पोर्ट करें:

```tsx
import Markdown, { compiler, parser, astToJSX } from 'markdown-to-jsx/vue'
import { h } from 'vue'

// कंपाइलर का उपयोग करना
const vnode = compiler('# नमस्कार दुनिया')

// कंपोनेंट का उपयोग करना
<Markdown children="# नमस्कार दुनिया" />

// या parser + astToJSX का उपयोग करें
const ast = parser('# नमस्कार दुनिया')
const vnode2 = astToJSX(ast)
```

**Vue.js-विशिष्ट सुविधाएं:**

- **Vue 3 समर्थन**: Vue 3 के `h()` रेंडर फ़ंक्शन API का उपयोग करता है
- **JSX समर्थन**: `@vue/babel-plugin-jsx` या `@vitejs/plugin-vue-jsx` के माध्यम से Vue 3 JSX के साथ काम करता है
- **HTML एट्रिब्यूट्स**: मानक HTML एट्रिब्यूट्स का उपयोग करता है (`className` के बजाय `class`)
- **कंपोनेंट ओवरराइड्स**: Options API और Composition API कंपोनेंट्स दोनों के लिए समर्थन

<h4 id="html">HTML</h4>

HTML स्ट्रिंग आउटपुट (सर्वर-साइड रेंडरिंग) के लिए, `/html` एंट्री पॉइंट से इम्पोर्ट करें:

```tsx
import { compiler, html, parser } from 'markdown-to-jsx/html'

const htmlString = compiler('# नमस्कार दुनिया')

/** या parser + html का उपयोग करें */
const ast = parser('# नमस्कार दुनिया')
const htmlString2 = html(ast)
```

<h4 id="markdown">Markdown</h4>

markdown-to-markdown कंपाइलेशन (सामान्यीकरण और फ़ॉर्मेटिंग) के लिए, `/markdown` एंट्री पॉइंट से इम्पोर्ट करें:

```typescript
import { compiler, astToMarkdown, parser } from 'markdown-to-jsx/markdown'

const normalizedMarkdown = compiler('# Hello  world\n\nExtra spaces!')

/** या AST के साथ काम करें */
const ast = parser('# Hello  world')
const normalizedMarkdown2 = astToMarkdown(ast)
```

<h3 id="library-options">लाइब्रेरी विकल्प</h3>

<h4 id="all-options">सभी विकल्प</h4>

| विकल्प                          | टाइप                          | डिफ़ॉल्ट | विवरण                                                                                                                                                  |
| ------------------------------- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createElement`                 | `function`                    | -        | कस्टम createElement व्यवहार (केवल React/React Native/SolidJS/Vue)। विवरण के लिए [createElement](#optionscreateelement) देखें।                          |
| `disableAutoLink`               | `boolean`                     | `false`  | नंगे URLs के एंकर टैग में स्वचालित रूपांतरण को अक्षम करें।                                                                                             |
| `disableParsingRawHTML`         | `boolean`                     | `false`  | raw HTML की JSX में पार्सिंग को अक्षम करें।                                                                                                            |
| `enforceAtxHeadings`            | `boolean`                     | `false`  | `#` और हेडर टेक्स्ट के बीच स्पेस की आवश्यकता है (GFM spec अनुपालन)।                                                                                    |
| `evalUnserializableExpressions` | `boolean`                     | `false`  | ⚠️ अनसीरियलाइज़ेबल props को eval करें (खतरनाक)। विवरण के लिए [evalUnserializableExpressions](#optionsevalunserializableexpressions) देखें।             |
| `forceBlock`                    | `boolean`                     | `false`  | सभी सामग्री को ब्लॉक-स्तर के रूप में माना जाए।                                                                                                         |
| `forceInline`                   | `boolean`                     | `false`  | सभी सामग्री को इनलाइन के रूप में माना जाए।                                                                                                             |
| `forceWrapper`                  | `boolean`                     | `false`  | एकल चाइल्ड के साथ भी रैपर को बाध्य करें (केवल React/React Native/Vue)। विवरण के लिए [forceWrapper](#optionsforcewrapper) देखें।                        |
| `overrides`                     | `object`                      | -        | HTML टैग रेंडरिंग को ओवरराइड करें। विवरण के लिए [overrides](#optionsoverrides) देखें।                                                                  |
| `preserveFrontmatter`           | `boolean`                     | `false`  | रेंडर किए गए आउटपुट में फ्रंटमैटर शामिल करें (HTML/JSX के लिए `<pre>` के रूप में, markdown में शामिल)। व्यवहार कंपाइलर प्रकार के अनुसार भिन्न होता है। |
| `renderRule`                    | `function`                    | -        | AST नियमों के लिए कस्टम रेंडरिंग। विवरण के लिए [renderRule](#optionsrenderrule) देखें।                                                                 |
| `sanitizer`                     | `function`                    | built-in | कस्टम URL सैनिटाइज़र फ़ंक्शन। विवरण के लिए [sanitizer](#optionssanitizer) देखें।                                                                       |
| `slugify`                       | `function`                    | built-in | हेडिंग IDs के लिए कस्टम slug जनरेशन। विवरण के लिए [slugify](#optionsslugify) देखें।                                                                    |
| `ignoreHTMLBlocks`              | `boolean`                     | `false`  | HTML ब्लॉक्स की पार्सिंग को अक्षम करें, उन्हें प्लेन टेक्स्ट के रूप में माना जाए।                                                                         |
| `optimizeForStreaming`          | `boolean`                     | `false`  | स्ट्रीमिंग के लिए अपूर्ण markdown सिंटैक्स की रेंडरिंग को दबाएं। विवरण के लिए [स्ट्रीमिंग Markdown](#स्ट्रीमिंग-markdown) देखें।                          |
| `tagfilter`                     | `boolean`                     | `true`   | XSS को रोकने के लिए खतरनाक HTML टैग (`script`, `iframe`, `style`, आदि) को एस्केप करें।                                                                 |
| `wrapper`                       | `string \| component \| null` | `'div'`  | एकाधिक children के लिए रैपर एलिमेंट (केवल React/React Native/Vue)। विवरण के लिए [wrapper](#optionswrapper) देखें।                                      |
| `wrapperProps`                  | `object`                      | -        | रैपर एलिमेंट के लिए props (केवल React/React Native/Vue)। विवरण के लिए [wrapperProps](#optionswrapperprops) देखें।                                      |

<h4 id="optionscreateelement">options.createElement</h4>

कभी-कभी, आप JSX के रेंडर होने से पहले रेंडरिंग प्रक्रिया में हुक करने के लिए `React.createElement` डिफ़ॉल्ट व्यवहार को ओवरराइड करना चाह सकते हैं। यह रनटाइम स्थितियों के आधार पर अतिरिक्त children जोड़ने या कुछ props को संशोधित करने के लिए उपयोगी हो सकता है। फ़ंक्शन `React.createElement` फ़ंक्शन को मिरर करता है, इसलिए params [`type, [props], [...children]`](https://reactjs.org/docs/react-api.html#createelement) हैं:

```javascript
import Markdown from 'markdown-to-jsx'
import React from 'react'
import { render } from 'react-dom'

const md = `
# नमस्कार दुनिया
`

render(
  <Markdown
    children={md}
    options={{
      createElement(type, props, children) {
        return (
          <div className="parent">
            {React.createElement(type, props, children)}
          </div>
        )
      },
    }}
  />,
  document.body
)
```

<h4 id="optionsforcewrapper">options.forceWrapper</h4>

डिफ़ॉल्ट रूप से, कंपाइलर रेंडर की गई सामग्री को रैप नहीं करता है यदि केवल एक चाइल्ड है। आप `forceWrapper` को `true` पर सेट करके इसे बदल सकते हैं। यदि चाइल्ड इनलाइन है, तो यह आवश्यक रूप से `span` में रैप नहीं होगा।

```tsx
// एकल, इनलाइन चाइल्ड के साथ `forceWrapper` का उपयोग करना…
<Markdown options={{ wrapper: 'aside', forceWrapper: true }}>
  Mumble, mumble…
</Markdown>

// रेंडर करता है

<aside>Mumble, mumble…</aside>
```

<h4 id="optionsoverrides">options.overrides</h4>

HTML टैग रेंडरिंग को ओवरराइड करें या कस्टम React कंपोनेंट्स रेंडर करें। तीन उपयोग के मामले:

**1. टैग हटाएं:** टैग को पूरी तरह से हटाने के लिए `null` रिटर्न करें (`tagfilter` escaping से परे):

```tsx
<Markdown options={{ overrides: { iframe: () => null } }}>
  <iframe src="..."></iframe>
</Markdown>
```

**2. HTML टैग ओवरराइड करें:** कंपोनेंट, props, या दोनों बदलें:

```tsx
const MyParagraph = ({ children, ...props }) => <div {...props}>{children}</div>

<Markdown options={{ overrides: { h1: { component: MyParagraph, props: { className: 'foo' } } } }}>
  # Hello
</Markdown>

/** सरलीकृत */ { overrides: { h1: MyParagraph } }
```

**3. React कंपोनेंट्स रेंडर करें:** markdown में कस्टम कंपोनेंट्स का उपयोग करें:

```tsx
import DatePicker from './date-picker'

const md = `<DatePicker timezone="UTC+5" startTime={1514579720511} />`

<Markdown options={{ overrides: { DatePicker } }}>{md}</Markdown>
```

**महत्वपूर्ण नोट्स:**

- **JSX props को बुद्धिमानी से पार्स किया जाता है** (v9.1+):
  - Arrays और objects: `data={[1, 2, 3]}` → `[1, 2, 3]` के रूप में पार्स किया गया
  - Booleans: `enabled={true}` → `true` के रूप में पार्स किया गया
  - Functions: `onClick={() => ...}` → सुरक्षा के लिए स्ट्रिंग के रूप में रखा गया (केस-बाई-केस हैंडलिंग के लिए [renderRule](#optionsrenderrule) का उपयोग करें, या [evalUnserializableExpressions](#optionsevalunserializableexpressions) देखें)
  - जटिल expressions: `value={someVar}` → स्ट्रिंग के रूप में रखा गया
- कुछ props संरक्षित हैं: `a` (`href`, `title`), `img` (`src`, `alt`, `title`), `input[type="checkbox"]` (`checked`, `readonly`), `ol` (`start`), `td`/`th` (`style`)
- एलिमेंट मैपिंग: इनलाइन टेक्स्ट के लिए `span`, इनलाइन कोड के लिए `code`, कोड ब्लॉक्स के लिए `pre > code`

<h4 id="optionsevalunserializableexpressions">options.evalUnserializableExpressions</h4>

**⚠️ सुरक्षा चेतावनी: उपयोगकर्ता इनपुट के लिए अत्यधिक हतोत्साहित**

जब सक्षम किया जाता है, तो JSX props में expressions को eval करने का प्रयास करता है जिन्हें JSON के रूप में सीरियलाइज़ नहीं किया जा सकता है (फ़ंक्शन, वेरिएबल, जटिल expressions)। यह `eval()` का उपयोग करता है जो मनमाने कोड को निष्पादित कर सकता है।

**डिफ़ॉल्ट रूप से (अनुशंसित)**, अनसीरियलाइज़ेबल expressions को सुरक्षा के लिए स्ट्रिंग्स के रूप में रखा जाता है:

```tsx
import { parser } from 'markdown-to-jsx'

const ast = parser('<Button onClick={() => alert("hi")} />')
// ast[0].attrs.onClick === "() => alert(\"hi\")" (स्ट्रिंग, सुरक्षित)

// Arrays और objects स्वचालित रूप से पार्स किए जाते हैं (कोई eval की आवश्यकता नहीं):
const ast2 = parser('<Table data={[1, 2, 3]} />')
// ast2[0].attrs.data === [1, 2, 3] (JSON.parse के माध्यम से पार्स किया गया)
```

**केवल इस विकल्प को सक्षम करें जब:**

- Markdown स्रोत पूरी तरह से विश्वसनीय है (उदाहरण के लिए, आपका अपना दस्तावेज़ीकरण)
- आप सभी JSX कंपोनेंट्स और उनके props को नियंत्रित करते हैं
- सामग्री उपयोगकर्ता-जनित या उपयोगकर्ता-संपादन योग्य नहीं है

**इस विकल्प को सक्षम न करें जब:**

- उपयोगकर्ता-सबमिट किए गए markdown को प्रोसेस कर रहे हों
- अविश्वसनीय सामग्री रेंडर कर रहे हों
- उपयोगकर्ता सामग्री वाले सार्वजनिक-सामना करने वाले एप्लिकेशन बना रहे हों

**खतरे का उदाहरण:**

```tsx
// दुर्भावनापूर्ण कोड के साथ उपयोगकर्ता-सबमिट किया गया markdown
const userMarkdown = '<Component onClick={() => fetch("/admin/delete-all")} />'

// ❌ खतरनाक - फ़ंक्शन निष्पादन योग्य होगा
parser(userMarkdown, { evalUnserializableExpressions: true })

// ✅ सुरक्षित - फ़ंक्शन स्ट्रिंग के रूप में रखा गया
parser(userMarkdown) // डिफ़ॉल्ट व्यवहार
```

**सुरक्षित विकल्प: केस-बाई-केस हैंडलिंग के लिए renderRule का उपयोग करें:**

```tsx
// मनमाने expressions को eval करने के बजाय, उन्हें renderRule में चुनिंदा रूप से संभालें:
const handlers = {
  handleClick: () => console.log('clicked'),
  handleSubmit: () => console.log('submitted'),
}

compiler(markdown, {
  renderRule(next, node) {
    if (
      node.type === RuleType.htmlBlock &&
      typeof node.attrs?.onClick === 'string'
    ) {
      // विकल्प 1: नामित हैंडलर लुकअप (सबसे सुरक्षित)
      const handler = handlers[node.attrs.onClick]
      if (handler) {
        return <button onClick={handler}>{/* ... */}</button>
      }

      // विकल्प 2: allowlist के साथ चयनात्मक eval (अभी भी जोखिम भरा)
      if (
        node.tag === 'TrustedComponent' &&
        node.attrs.onClick.startsWith('() =>')
      ) {
        try {
          const fn = eval(`(${node.attrs.onClick})`)
          return <button onClick={fn}>{/* ... */}</button>
        } catch (e) {
          // त्रुटि संभालें
        }
      }
    }
    return next()
  },
})
```

यह दृष्टिकोण आपको पूर्ण नियंत्रण देता है कि कौन से expressions का मूल्यांकन किया जाता है और किन शर्तों के तहत।

<h4 id="optionsignorehtmlblocks">options.ignoreHTMLBlocks</h4>

सक्षम होने पर, पार्सर HTML ब्लॉक्स को पार्स करने का प्रयास नहीं करेगा। HTML सिंटैक्स को प्लेन टेक्स्ट के रूप में माना जाएगा और जैसा है वैसा ही रेंडर किया जाएगा।

```tsx
<Markdown options={{ ignoreHTMLBlocks: true }}>
  {'<div class="custom">यह टेक्स्ट के रूप में रेंडर किया जाएगा</div>'}
</Markdown>
```

<h4 id="optionsrenderrule">options.renderRule</h4>

अपना खुद का रेंडरिंग फ़ंक्शन प्रदान करें जो चुनिंदा रूप से ओवरराइड कर सकता है कि _नियम_ कैसे रेंडर किए जाते हैं (नोट करें, यह _`options.overrides`_ से अलग है जो HTML टैग स्तर पर संचालित होता है और अधिक सामान्य है)। `renderRule` फ़ंक्शन हमेशा किसी भी अन्य रेंडरिंग कोड से पहले निष्पादित होता है, जो आपको नोड्स के रेंडर होने के तरीके पर पूर्ण नियंत्रण देता है, जिसमें सामान्य रूप से छोड़े गए नोड्स जैसे `ref`, `footnote`, और `frontmatter` शामिल हैं।

आप इस कार्यक्षमता का उपयोग स्थापित AST नोड के साथ लगभग कुछ भी करने के लिए कर सकते हैं; यहां `@matejmazur/react-katex` लाइब्रेरी का उपयोग करके LaTeX सिंटैक्स को प्रोसेस करने के लिए चुनिंदा रूप से "codeBlock" नियम को ओवरराइड करने का एक उदाहरण है:

````tsx
import Markdown, { RuleType } from 'markdown-to-jsx'
import TeX from '@matejmazur/react-katex'

const exampleContent =
  'Some important formula:\n\n```latex\nmathbb{N} = { a in mathbb{Z} : a > 0 }\n```\n'

function App() {
  return (
    <Markdown
      children={exampleContent}
      options={{
        renderRule(next, node, renderChildren, state) {
          if (node.type === RuleType.codeBlock && node.lang === 'latex') {
            return (
              <TeX as="div" key={state.key}>{String.raw`${node.text}`}</TeX>
            )
          }

          return next()
        },
      }}
    />
  )
}
````

**पार्स की गई HTML सामग्री तक पहुंचना:** HTML ब्लॉक्स (`<script>`, `<style>`, `<pre>` जैसे) के लिए, `renderRule` `children` में पूरी तरह से पार्स की गई AST तक पहुंच सकता है:

```tsx
<Markdown
  options={{
    renderRule(next, node, renderChildren) {
      if (node.type === RuleType.htmlBlock && node.tag === 'script') {
        // कस्टम रेंडरिंग के लिए पार्स किए गए children तक पहुंचें
        const parsedContent = node.children || []
        return <CustomScript content={parsedContent} />
      }
      return next()
    },
  }}
>
  <script>Hello **world**</script>
</Markdown>
```

<h4 id="optionssanitizer">options.sanitizer</h4>

डिफ़ॉल्ट रूप से एक हल्का URL सैनिटाइज़र फ़ंक्शन प्रदान किया जाता है ताकि सामान्य हमले वैक्टरों से बचा जा सके जो एंकर टैग के `href` में रखे जा सकते हैं, उदाहरण के लिए। सैनिटाइज़र इनपुट, लक्षित HTML टैग, और एट्रिब्यूट नाम प्राप्त करता है। मूल फ़ंक्शन `sanitizer` नामक लाइब्रेरी export के रूप में उपलब्ध है।

यदि वांछित हो तो इसे `options.sanitizer` के माध्यम से एक कस्टम सैनिटाइज़र से ओवरराइड और प्रतिस्थापित किया जा सकता है:

<!-- prettier-ignore -->
```tsx
// इस स्थिति में सैनिटाइज़र प्राप्त करेगा:
// ('javascript:alert("foo")', 'a', 'href')

<Markdown options={{ sanitizer: (value, tag, attribute) => value }}>
  {`[foo](javascript:alert("foo"))`}
</Markdown>

// या

compiler('[foo](javascript:alert("foo"))', {
  sanitizer: value => value,
})
```

<h4 id="optionsslugify">options.slugify</h4>

डिफ़ॉल्ट रूप से, हेडिंग से HTML id जनरेट करने के लिए एक [हल्का deburring फ़ंक्शन](https://github.com/quantizor/markdown-to-jsx/blob/bc2f57412332dc670f066320c0f38d0252e0f057/index.js#L261-L275) का उपयोग किया जाता है। आप `options.slugify` को एक फ़ंक्शन पास करके इसे ओवरराइड कर सकते हैं। यह तब मददगार होता है जब आप हेडिंग में गैर-अल्फ़ान्यूमेरिक वर्णों (उदाहरण के लिए चीनी या जापानी वर्ण) का उपयोग कर रहे हों। उदाहरण के लिए:

<!-- prettier-ignore -->
```tsx
<Markdown options={{ slugify: str => str }}># 中文</Markdown>
compiler('# 中文', { slugify: str => str })
```

मूल फ़ंक्शन `slugify` नामक लाइब्रेरी export के रूप में उपलब्ध है।

<h4 id="optionswrapper">options.wrapper</h4>

जब एकाधिक children को रेंडर किया जाना है, तो कंपाइलर डिफ़ॉल्ट रूप से आउटपुट को `div` में रैप करेगा। आप `wrapper` विकल्प को या तो एक स्ट्रिंग (React Element) या एक कंपोनेंट पर सेट करके इस डिफ़ॉल्ट को ओवरराइड कर सकते हैं।

```tsx
const str = '# Heck Yes\n\nThis is great!'

<Markdown options={{ wrapper: 'article' }}>{str}</Markdown>

compiler(str, { wrapper: 'article' })
```

<h5 id="other-useful-recipes">अन्य उपयोगी रेसिपीज़</h5>

बिना रैपर के children की एक array वापस पाने के लिए, `wrapper` को `null` पर सेट करें। यह विशेष रूप से उपयोगी है जब सीधे `compiler(…)` का उपयोग कर रहे हों।

```tsx
compiler('One\n\nTwo\n\nThree', { wrapper: null })[
  /** रिटर्न करता है */ ((<p>One</p>), (<p>Two</p>), (<p>Three</p>))
]
```

बिना किसी HTML रैपर के `<Markdown>` के समान DOM स्तर पर children रेंडर करने के लिए, `wrapper` को `React.Fragment` पर सेट करें। यह अभी भी रेंडरिंग के उद्देश्यों के लिए आपके children को एक React नोड में रैप करेगा, लेकिन रैपर एलिमेंट DOM में दिखाई नहीं देगा।

<h4 id="optionswrapperprops">options.wrapperProps</h4>

जब `wrapper` का उपयोग किया जाता है तो रैपर एलिमेंट पर लागू करने के लिए props।

```tsx
<Markdown
  options={{
    wrapper: 'article',
    wrapperProps: { className: 'post', 'data-testid': 'markdown-content' },
  }}
>
  # Hello World
</Markdown>
```

<h3 id="syntax-highlighting">सिंटैक्स हाइलाइटिंग</h3>

भाषा एनोटेशन के साथ [fenced code blocks](https://www.markdownguide.org/extended-syntax/#syntax-highlighting) का उपयोग करते समय, वह भाषा `<code>` एलिमेंट में `class="lang-${language}"` के रूप में जोड़ी जाएगी। सर्वोत्तम परिणामों के लिए, आप `options.overrides` का उपयोग करके `highlight.js` का उपयोग करके इस तरह एक उपयुक्त सिंटैक्स हाइलाइटिंग एकीकरण प्रदान कर सकते हैं:

```html
<!-- अपने पेज <head> में निम्नलिखित टैग जोड़ें ताकि hljs और स्टाइल्स स्वचालित रूप से लोड हों: -->
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/obsidian.min.css"
/>

<script
  crossorigin
  src="https://unpkg.com/@highlightjs/cdn-assets@11.9.0/highlight.min.js"
></script>
```

````tsx
import { Markdown, RuleType } from 'markdown-to-jsx'

const mdContainingFencedCodeBlock =
  '```js\nconsole.log("नमस्कार दुनिया!");\n```\n'

function App() {
  return (
    <Markdown
      children={mdContainingFencedCodeBlock}
      options={{
        overrides: {
          code: SyntaxHighlightedCode,
        },
      }}
    />
  )
}

function SyntaxHighlightedCode(props) {
  const ref = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (ref.current && props.className?.includes('lang-') && window.hljs) {
      window.hljs.highlightElement(ref.current)

      // hljs एलिमेंट को फिर से प्रोसेस नहीं करेगा जब तक यह एट्रिब्यूट हटाया नहीं जाता
      ref.current.removeAttribute('data-highlighted')
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}
````

<h3 id="handling-shortcodes">शॉर्टकोड्स को हैंडल करना</h3>

`:smile:` जैसे मनमाने शॉर्टकोड्स के साथ Slack-शैली मैसेजिंग के लिए, आप प्लेन टेक्स्ट रेंडरिंग में हुक करने के लिए `options.renderRule` का उपयोग कर सकते हैं और चीजों को अपनी पसंद के अनुसार समायोजित कर सकते हैं, उदाहरण के लिए:

```tsx
import Markdown, { RuleType } from 'markdown-to-jsx'

const shortcodeMap = {
  smile: '🙂',
}

const detector = /(:[^:]+:)/g

const replaceEmoji = (text: string): React.ReactNode => {
  return text.split(detector).map((part, index) => {
    if (part.startsWith(':') && part.endsWith(':')) {
      const shortcode = part.slice(1, -1)

      return <span key={index}>{shortcodeMap[shortcode] || part}</span>
    }

    return part
  })
}

function Example() {
  return (
    <Markdown
      options={{
        renderRule(next, node) {
          if (node.type === RuleType.text && detector.test(node.text)) {
            return replaceEmoji(node.text)
          }

          return next()
        },
      }}
    >
      {`On a beautiful summer day, all I want to do is :smile:.`}
    </Markdown>
  )
}
```

जब आप `options.renderRule` का उपयोग करते हैं, तो छवियों और GIFs सहित कोई भी React-रेंडर करने योग्य JSX रिटर्न किया जा सकता है। सुनिश्चित करें कि आप अपने समाधान को बेंचमार्क करते हैं क्योंकि `text` नियम सिस्टम में सबसे गर्म पथों में से एक है!

<h3 id="स्ट्रीमिंग-markdown">स्ट्रीमिंग Markdown</h3>

जब markdown सामग्री क्रमिक रूप से आती है (जैसे, AI/LLM API, WebSocket, या सर्वर-सेंट इवेंट्स से), तो आप देख सकते हैं कि कच्चे markdown सिंटैक्स सही रेंडरिंग से पहले संक्षेप में दिखाई देते हैं। ऐसा इसलिए होता है क्योंकि `**बोल्ड टेक्स्ट` या `<CustomComponent>आंशिक सामग्री` जैसे अपूर्ण सिंटैक्स बंद करने वाले डेलिमीटर आने से पहले टेक्स्ट के रूप में रेंडर हो जाते हैं।

`optimizeForStreaming` विकल्प अपूर्ण markdown संरचनाओं का पता लगाकर और सामग्री पूर्ण होने तक `null` (React) या खाली स्ट्रिंग (HTML) रिटर्न करके इसे हल करता है:

```tsx
import Markdown from 'markdown-to-jsx/react'

function StreamingMarkdown({ content }) {
  return (
    <Markdown options={{ optimizeForStreaming: true }}>
      {content}
    </Markdown>
  )
}
```

**LLM / AI चैटबॉट एकीकरण:**

एक सामान्य पैटर्न LLM API (OpenAI, Anthropic, आदि) से स्ट्रीम किए गए प्रतिक्रियाओं को रेंडर करना है जहां tokens एक-एक करके आते हैं। `optimizeForStreaming` के बिना, उपयोगकर्ता प्रत्येक token के बीच raw markdown सिंटैक्स की विचलित करने वाली झलक देखते हैं। इसे सक्षम करने पर, अपूर्ण संरचनाओं को बंद करने वाले डेलिमीटर आने तक दबाया जाता है, जिससे एक सुचारू पठन अनुभव मिलता है:

```tsx
import Markdown from 'markdown-to-jsx/react'
import { useState, useEffect } from 'react'

function ChatMessage({ stream }) {
  const [content, setContent] = useState('')

  useEffect(() => {
    // LLM स्ट्रीम से tokens संचित करें
    stream.on('token', token => setContent(prev => prev + token))
  }, [stream])

  return <Markdown options={{ optimizeForStreaming: true }}>{content}</Markdown>
}
```

**यह क्या दबाता है:**

- अबंद HTML टैग (`<div>सामग्री` बिना `</div>`)
- अपूर्ण टैग सिंटैक्स (`<div attr="value` बिना बंद `>`)
- अबंद HTML कमेंट्स (`<!-- कमेंट` बिना `-->`)
- अबंद इनलाइन कोड (`` `कोड `` बिना बंद बैकटिक)
- अबंद बोल्ड/इटैलिक (`**टेक्स्ट` या `*टेक्स्ट` बिना बंद)
- अबंद स्ट्राइकथ्रू (`~~टेक्स्ट` बिना बंद `~~`)
- अबंद लिंक (`[टेक्स्ट](url` बिना बंद `)`)
- अपूर्ण टेबल (केवल हेडर और सेपरेटर पंक्ति बिना डेटा पंक्तियों के)

**सामान्य रूप से रेंडर (स्ट्रीमिंग के दौरान सामग्री दिखाई देती है):**

- फ़ेंस्ड कोड ब्लॉक्स - सामग्री आने पर दिखाई देती है, बंद करने वाले फ़ेंस की प्रतीक्षा करते हुए

<h3 id="usage-with-preact">Preact के साथ उपयोग</h3>

सब कुछ बिल्कुल ठीक काम करेगा! बस [`react` को `preact/compat` पर alias करें](https://preactjs.com/guide/v10/switching-to-preact#setting-up-compat) जैसा कि आप शायद पहले से ही कर रहे हैं।

<h3 id="ast-anatomy">AST संरचना</h3>

Abstract Syntax Tree (AST) पार्स किए गए markdown का एक संरचित प्रतिनिधित्व है। AST में प्रत्येक नोड में एक `type` property होती है जो इसकी प्रकार की पहचान करती है, और type-विशिष्ट properties।

**महत्वपूर्ण:** AST में पहला नोड आमतौर पर एक `RuleType.refCollection` नोड होता है जिसमें दस्तावेज़ में पाई गई सभी संदर्भ परिभाषाएं शामिल होती हैं, जिनमें फ़ुटनोट्स (`^` के साथ प्रीफ़िक्स किए गए कुंजियों के साथ संग्रहीत) शामिल हैं। यह नोड रेंडरिंग के दौरान छोड़ दिया जाता है लेकिन संदर्भ डेटा तक पहुंचने के लिए उपयोगी है। फ़ुटनोट्स को स्वचालित रूप से refCollection से निकाला जाता है और `compiler()` और `astToJSX()` दोनों द्वारा एक `<footer>` एलिमेंट में रेंडर किया जाता है।

<h4 id="node-types">नोड प्रकार</h4>

AST निम्नलिखित नोड प्रकारों से बना है (नोड प्रकारों की जांच करने के लिए `RuleType` का उपयोग करें):

**ब्लॉक-स्तरीय नोड्स:**

- `RuleType.heading` - हेडिंग्स (`# Heading`)
  ```tsx
  { type: RuleType.heading, level: 1, id: "heading", children: [...] }
  ```
- `RuleType.paragraph` - पैराग्राफ़
  ```tsx
  { type: RuleType.paragraph, children: [...] }
  ```
- `RuleType.codeBlock` - Fenced कोड ब्लॉक्स (```)
  ```tsx
  { type: RuleType.codeBlock, lang: "javascript", text: "code content", attrs?: { "data-line": "1" } }
  ```
- `RuleType.blockQuote` - ब्लॉककोट्स (`>`)
  ```tsx
  { type: RuleType.blockQuote, children: [...], alert?: "note" }
  ```
- `RuleType.orderedList` / `RuleType.unorderedList` - सूचियां
  ```tsx
  { type: RuleType.orderedList, items: [[...]], start?: 1 }
  { type: RuleType.unorderedList, items: [[...]] }
  ```
- `RuleType.table` - टेबल्स
  ```tsx
  { type: RuleType.table, header: [...], cells: [[...]], align: [...] }
  ```
- `RuleType.htmlBlock` - HTML ब्लॉक्स और JSX कंपोनेंट्स

  ```tsx
  { type: RuleType.htmlBlock, tag: "div", attrs?: Record<string, any>, children?: ASTNode[] }
  ```

  **नोट (v9.1+):** opening/closing टैग के बीच खाली लाइनों वाले JSX कंपोनेंट्स अब sibling नोड्स बनाने के बजाय children को ठीक से nest करते हैं।

  **HTML Block Parsing (v9.2+):** HTML ब्लॉक्स को हमेशा `children` property में पूरी तरह से पार्स किया जाता है। `renderRule` कॉलबैक सभी HTML ब्लॉक्स के लिए `children` में पूरी तरह से पार्स की गई AST तक पहुंच सकते हैं।

**इनलाइन नोड्स:**

- `RuleType.text` - प्लेन टेक्स्ट
  ```tsx
  { type: RuleType.text, text: "नमस्कार दुनिया" }
  ```
- `RuleType.textFormatted` - बोल्ड, इटैलिक, आदि।
  ```tsx
  { type: RuleType.textFormatted, tag: "strong", children: [...] }
  ```
- `RuleType.codeInline` - इनलाइन कोड (`` ` ``)
  ```tsx
  { type: RuleType.codeInline, text: "code" }
  ```
- `RuleType.link` - लिंक्स
  ```tsx
  { type: RuleType.link, target: "https://example.com", title?: "लिंक शीर्षक", children: [...] }
  ```
- `RuleType.image` - छवियां
  ```tsx
  { type: RuleType.image, target: "image.png", alt?: "description", title?: "छवि शीर्षक" }
  ```

**अन्य नोड्स:**

- `RuleType.breakLine` - हार्ड लाइन ब्रेक्स (`  `)
- `RuleType.breakThematic` - क्षैतिज नियम (`---`)
- `RuleType.gfmTask` - GFM टास्क लिस्ट आइटम्स (`- [ ]`)
  ```tsx
  { type: RuleType.gfmTask, completed: false }
  ```
- `RuleType.ref` - संदर्भ परिभाषा नोड (रेंडर नहीं किया गया, refCollection में संग्रहीत)
- `RuleType.refCollection` - संदर्भ परिभाषाएं संग्रह (AST root पर दिखाई देता है, `^` प्रीफ़िक्स के साथ footnotes शामिल हैं)
  ```tsx
  { type: RuleType.refCollection, refs: { "label": { target: "url", title: "शीर्षक" } } }
  ```
- `RuleType.footnote` - फ़ुटनोट परिभाषा नोड (रेंडर नहीं किया गया, refCollection में संग्रहीत)
- `RuleType.footnoteReference` - फ़ुटनोट संदर्भ (`[^identifier]`)
  ```tsx
  { type: RuleType.footnoteReference, target: "#fn-identifier", text: "1" }
  ```
- `RuleType.frontmatter` - YAML frontmatter ब्लॉक्स
  ```tsx
  { type: RuleType.frontmatter, text: "---\ntitle: My Title\n---" }
  ```
- `RuleType.htmlComment` - HTML कमेंट नोड्स
  ```tsx
  { type: RuleType.htmlComment, text: "टिप्पणी टेक्स्ट" }
  ```
- `RuleType.htmlSelfClosing` - स्व-बंद होने वाले HTML टैग
  ```tsx
  { type: RuleType.htmlSelfClosing, tag: "img", attrs?: { src: "image.png" } }
  ```

**JSX Prop Parsing (v9.1+):**

पार्सर बुद्धिमानी से JSX prop values को पार्स करता है:

- Arrays/objects को `JSON.parse()` के माध्यम से पार्स किया जाता है: `rows={[["a", "b"]]}` → `attrs.rows = [["a", "b"]]`
- Functions को सुरक्षा के लिए स्ट्रिंग्स के रूप में रखा जाता है: `onClick={() => ...}` → `attrs.onClick = "() => ..."`
- Booleans को पार्स किया जाता है: `enabled={true}` → `attrs.enabled = true`

<h4 id="example-ast-structure">उदाहरण AST संरचना</h4>

````tsx
import { parser, RuleType } from 'markdown-to-jsx'

const ast = parser(`# Hello World

This is a **paragraph** with [a link](https://example.com).

[linkref]: https://example.com

```javascript
console.log('code')
```

`)

// AST संरचना:
[
  // संदर्भ संग्रह (पहला नोड, यदि संदर्भ मौजूद हैं)
  {
    type: RuleType.refCollection,
    refs: {
      linkref: { target: 'https://example.com', title: undefined },
    },
  },
  {
    type: RuleType.heading,
    level: 1,
    id: 'hello-world',
    children: [{ type: RuleType.text, text: 'Hello World' }],
  },
  {
    type: RuleType.paragraph,
    children: [
      { type: RuleType.text, text: 'This is a ' },
      {
        type: RuleType.textFormatted,
        tag: 'strong',
        children: [{ type: RuleType.text, text: 'paragraph' }],
      },
      { type: RuleType.text, text: ' with ' },
      {
        type: RuleType.link,
        target: 'https://example.com',
        children: [{ type: RuleType.text, text: 'a link' }],
      },
      { type: RuleType.text, text: '.' },
    ],
  },
  {
    type: RuleType.codeBlock,
    lang: 'javascript',
    text: "console.log('code')",
  },
]

````

<h4 id="type-checking">टाइप जांच</h4>

AST नोड्स की पहचान करने के लिए `RuleType` enum का उपयोग करें:

```tsx
import { RuleType } from 'markdown-to-jsx'

if (node.type === RuleType.heading) {
  const heading = node as MarkdownToJSX.HeadingNode
  console.log(`Heading level ${heading.level}: ${heading.id}`)
}
```

**कब `compiler` बनाम `parser` बनाम `<Markdown>` का उपयोग करें:**

- `<Markdown>` का उपयोग करें जब आपको एक सरल React कंपोनेंट की आवश्यकता हो जो markdown को JSX में रेंडर करे।
- `compiler` का उपयोग करें जब आपको markdown से React JSX आउटपुट की आवश्यकता हो (कंपोनेंट आंतरिक रूप से इसका उपयोग करता है)।
- `parser` + `astToJSX` का उपयोग करें जब आपको JSX में रेंडर करने से पहले कस्टम प्रोसेसिंग के लिए AST की आवश्यकता हो, या बस AST स्वयं की।

<h3 id="gotchas">समस्याएं</h3>

**JSX prop parsing (v9.1+):** JSX props में Arrays और objects स्वचालित रूप से पार्स किए जाते हैं:

<!-- prettier-ignore -->
```tsx
// Markdown में:
<Table
  columns={['Name', 'Age']}
  data={[
    ['Alice', 30],
    ['Bob', 25],
  ]}
/>

// आपके कंपोनेंट में (v9.1+):
const Table = ({ columns, data, ...props }) => {
  // columns पहले से ही एक array है: ["Name", "Age"]
  // data पहले से ही एक array है: [["Alice", 30], ["Bob", 25]]
  // कोई JSON.parse की आवश्यकता नहीं!
}

// पिछड़ी संगतता के लिए, types की जांच करें:
const Table = ({ columns, data, ...props }) => {
  const parsedColumns =
    typeof columns === 'string' ? JSON.parse(columns) : columns
  const parsedData = typeof data === 'string' ? JSON.parse(data) : data
}
```

**Function props को स्ट्रिंग्स के रूप में रखा जाता है** सुरक्षा के लिए। केस-बाई-केस हैंडलिंग के लिए [renderRule](#optionsrenderrule) का उपयोग करें, या opt-in eval के लिए [evalUnserializableExpressions](#optionsevalunserializableexpressions) देखें।

**HTML indentation:** markdown सिंटैक्स संघर्षों से बचने के लिए HTML ब्लॉक्स में अग्रणी व्हाइटस्पेस को पहली लाइन के इंडेंटेशन के आधार पर स्वतः-ट्रिम किया जाता है।

**HTML में कोड:** HTML divs में सीधे कोड न डालें। इसके बजाय fenced code blocks का उपयोग करें:

````md
<div>
```js
var code = here();
```
</div>
````

<h2 id="changelog">परिवर्तन लॉग</h2>

[Github Releases](https://github.com/quantizor/markdown-to-jsx/releases) देखें।

<h2 id="donate">दान करें</h2>

यह लाइब्रेरी पसंद है? यह पूरी तरह से स्वैच्छिक आधार पर विकसित की गई है; यदि आप कर सकते हैं तो [Sponsor लिंक](https://github.com/sponsors/quantizor) के माध्यम से कुछ रुपये दान करें!
