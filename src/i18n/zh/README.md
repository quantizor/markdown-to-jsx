[![npm version](https://badge.fury.io/js/markdown-to-jsx.svg)](https://badge.fury.io/js/markdown-to-jsx) [![downloads](https://badgen.net/npm/dy/markdown-to-jsx)](https://npm-stat.com/charts.html?package=markdown-to-jsx)

`markdown-to-jsx` 是一个为 JavaScript 和 TypeScript 项目设计的符合 GFM+CommonMark 规范的 Markdown 解析器 (Parser) 和编译器 (Compiler) 工具链。它的速度极快，能够处理大型文档，足以满足实时交互的需求。

本库的一些特别功能：

- 支持任意 HTML 并将其解析为适当的 JSX 表示，而无需使用 `dangerouslySetInnerHTML`。

- 编译器和/或 `<Markdown>` 组件渲染的任何 HTML 标签都可以被覆盖 (Override)，以包含额外的属性 (Props) 甚至完全不同的 HTML 表示。

- 支持所有 GFM 特殊语法，包括表格、任务列表、删除线、自动链接、标签过滤等。

- 支持 [highlight.js](https://highlightjs.org/) 的围栏代码块 (Fenced code blocks)；有关设置 highlight.js 的说明，请参阅[语法高亮 (Syntax highlighting)](#语法高亮-syntax-highlighting)。

<h2>目录</h2>

<!-- TOC -->

- [升级 Upgrading](#%E5%8D%87%E7%BA%A7-upgrading)
  - [从 v8.x 升级到 v9.x](#%E4%BB%8E-v8x-%E5%8D%87%E7%BA%A7%E5%88%B0-v9x)
  - [从 v7.x 升级到 v8.x](#%E4%BB%8E-v7x-%E5%8D%87%E7%BA%A7%E5%88%B0-v8x)
- [安装 Installation](#%E5%AE%89%E8%A3%85-installation)
- [用法 Usage](#%E7%94%A8%E6%B3%95-usage)
  - [入口点 Entry Points](#%E5%85%A5%E5%8F%A3%E7%82%B9-entry-points)
    - [主入口 Main](#%E4%B8%BB%E5%85%A5%E5%8F%A3-main)
    - [React](#react)
      - [React Server Components RSC](#react-server-components-rsc)
    - [React Native](#react-native)
    - [SolidJS](#solidjs)
    - [Vue.js](#vuejs)
    - [HTML](#html)
    - [Markdown](#markdown)
  - [库选项 Library Options](#%E5%BA%93%E9%80%89%E9%A1%B9-library-options)
    - [所有选项](#%E6%89%80%E6%9C%89%E9%80%89%E9%A1%B9)
    - [options.createElement](#optionscreateelement)
    - [options.forceWrapper](#optionsforcewrapper)
    - [options.overrides](#optionsoverrides)
    - [options.evalUnserializableExpressions](#optionsevalunserializableexpressions)
    - [options.renderRule](#optionsrenderrule)
    - [options.sanitizer](#optionssanitizer)
    - [options.slugify](#optionsslugify)
    - [options.wrapper](#optionswrapper)
      - [其他有用示例](#%E5%85%B6%E4%BB%96%E6%9C%89%E7%94%A8%E7%A4%BA%E4%BE%8B)
    - [options.wrapperProps](#optionswrapperprops)
  - [语法高亮 Syntax highlighting](#%E8%AF%AD%E6%B3%95%E9%AB%98%E4%BA%AE-syntax-highlighting)
  - [处理短代码 Handling shortcodes](#%E5%A4%84%E7%90%86%E7%9F%AD%E4%BB%A3%E7%A0%81-handling-shortcodes)
  - [流式 Markdown](#%E6%B5%81%E5%BC%8F-markdown)
  - [在 Preact 中使用](#%E5%9C%A8-preact-%E4%B8%AD%E4%BD%BF%E7%94%A8)
  - [AST 结构解析 AST Anatomy](#ast-%E7%BB%93%E6%9E%84%E8%A7%A3%E6%9E%90-ast-anatomy)
    - [节点类型 Node Types](#%E8%8A%82%E7%82%B9%E7%B1%BB%E5%9E%8B-node-types)
    - [AST 结构示例](#ast-%E7%BB%93%E6%9E%84%E7%A4%BA%E4%BE%8B)
    - [类型检查](#%E7%B1%BB%E5%9E%8B%E6%A3%80%E6%9F%A5)
  - [注意事项 Gotchas](#%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9-gotchas)
- [更新日志 Changelog](#%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97-changelog)
- [捐赠 Donate](#%E6%8D%90%E8%B5%A0-donate)

<!-- /TOC -->

## 升级 (Upgrading)

### 从 v8.x 升级到 v9.x

**破坏性变更 (Breaking Changes)：**

- **`ast` 选项已移除**：`compiler()` 上的 `ast: true` 选项已被移除。请改用新的 `parser()` 函数直接访问抽象语法树 (AST)。

```typescript
/** v8 */ compiler('# 你好世界', { ast: true })
/** v9 */ parser('# 你好世界')
```

- **`namedCodesToUnicode` 选项已移除**：`namedCodesToUnicode` 选项已被移除。现在默认通过完整的实体列表支持所有命名的 HTML 实体，因此不再需要自定义实体映射。

```typescript
/** v8 */ compiler('&le; symbol', { namedCodesToUnicode: { le: '\u2264' } })
/** v9 */ compiler('&le; symbol')
```

- **`tagfilter` 默认启用**：危险的 HTML 标签 (`script`, `iframe`, `style`, `title`, `textarea`, `xmp`, `noembed`, `noframes`, `plaintext`) 现在在 HTML 字符串输出和 React JSX 输出中默认都会被转义。以前在 React 输出中，这些标签会被渲染为 JSX 元素。

```typescript
/** v8 */ 标签被渲染为 JSX 元素
/** v9 */ 标签默认被转义
compiler('<script>alert("xss")</script>') // <span>&lt;script&gt;</span>

/** 恢复旧行为 */
compiler('<script>alert("xss")</script>', { tagfilter: false })
```

**新功能：**

- **新的 `parser` 函数**：提供对解析后的 AST 的直接访问，无需渲染。这是获取 AST 节点的推荐方式。

- **新的入口点**：现在提供 React 特定、HTML 特定和 Markdown 特定的入口点，以实现更好的 Tree-shaking 和关注点分离。

```typescript
// React 特定用法
import Markdown, { compiler, parser } from 'markdown-to-jsx/react'

// HTML 字符串输出
import { compiler, astToHTML, parser } from 'markdown-to-jsx/html'

// Markdown 字符串输出 (往返编译)
import { compiler, astToMarkdown, parser } from 'markdown-to-jsx/markdown'
```

**迁移指南 (Migration Guide)：**

1. **将 `compiler(..., { ast: true })` 替换为 `parser()`**：

```typescript
/** v8 */ compiler(markdown, { ast: true })
/** v9 */ parser(markdown)
```

2. **将 React 导入迁移到 `/react` 入口点**（可选但推荐）：

```typescript
/** 旧版 */ import from 'markdown-to-jsx'
/** 推荐 */ import from 'markdown-to-jsx/react'
```

3. **移除 `namedCodesToUnicode` 选项**：现在自动支持所有命名的 HTML 实体，因此您可以移除任何自定义实体映射。

```typescript
/** v8 */ compiler('&le; symbol', { namedCodesToUnicode: { le: '\u2264' } })
/** v9 */ compiler('&le; symbol')
```

**注意：** 主入口点 (`markdown-to-jsx`) 仍可继续使用以保持向后兼容性，但其中的 React 代码已被弃用，并将在未来的主要版本中移除。请考虑迁移到 `markdown-to-jsx/react` 以供 React 特定使用。

<details>
<summary>### 旧版迁移指南</summary>

### 从 v7.x 升级到 v8.x

**破坏性变更 (Breaking Changes)：**

- 类型 `ParserResult` 重命名为 `ASTNode` - 如果您在代码中使用 `MarkdownToJSX.ParserResult`，请更新为 `MarkdownToJSX.ASTNode`

```typescript
/** v7 */ MarkdownToJSX.ParserResult[]
/** v8+ */ MarkdownToJSX.ASTNode[]
```

- 多个 `RuleType` 枚举合并为 `RuleType.textFormatted` - 如果您之前在检查 `RuleType.textBolded`, `RuleType.textEmphasized`, `RuleType.textMarked` 或 `RuleType.textStrikethroughed`，请更新为检查 `RuleType.textFormatted` 并检查节点的布尔标志：

```typescript
/** v7 */ RuleType.textBolded
/** v8+ */ RuleType.textFormatted && node.bold
```

</details>

## 安装 (Installation)

使用您喜欢的包管理器安装 `markdown-to-jsx`。

```shell
npm i markdown-to-jsx
```

## 用法 (Usage)

`markdown-to-jsx` 默认导出一个 React 组件，方便 JSX 组合：

ES6 风格用法\*：

```tsx
import Markdown from 'markdown-to-jsx'
import React from 'react'
import { render } from 'react-dom'

render(<Markdown># 你好世界!</Markdown>, document.body)

/*
    渲染结果：

    <h1>你好世界!</h1>
 */
```

\* **注意：JSX 原生并不保留多行文本中的换行符。通常情况下，不鼓励直接在 JSX 中编写 Markdown，更好的做法是将内容保存在单独的 .md 文件中并导入它们，例如使用 webpack 的 [raw-loader](https://github.com/webpack-contrib/raw-loader)。**

### 入口点 (Entry Points)

`markdown-to-jsx` 为不同的用例提供了多个入口点：

#### 主入口 (Main)

旧版默认入口点导出所有内容，包括 React 编译器和组件：

```tsx
import Markdown, { compiler, parser } from 'markdown-to-jsx'
```

_此入口点中的 React 代码已被弃用，并将在未来的主要版本中移除，请迁移到 `markdown-to-jsx/react`。_

#### React

对于 React 特定用法，从 `/react` 入口点导入：

```tsx
import Markdown, { compiler, parser, astToJSX } from 'markdown-to-jsx/react'

const jsxElement = compiler('# 你好世界')

function App() {
  return <Markdown children="# 你好世界" />
}

/** 或者使用 parser + astToJSX */
const ast = parser('# 你好世界')
const jsxElement2 = astToJSX(ast)
```

##### React Server Components (RSC)

`Markdown` 组件会自动检测它是在 React Server Component (RSC) 还是客户端环境中运行并进行相应调整。无需 'use client' 指令。

**Server Component (RSC) 用法：**

```tsx
// Server Component - 自动工作
import Markdown from 'markdown-to-jsx/react'

export default async function Page() {
  const content = await fetchMarkdownContent()
  return <Markdown>{content}</Markdown>
}
```

**Client Component 用法：**

```tsx
// Client Component - 同样自动工作
'use client'
import Markdown from 'markdown-to-jsx/react'

export function ClientMarkdown({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>
}
```

**注意：**

- `MarkdownProvider` 和 `MarkdownContext` 仅限客户端，在 RSC 环境中将变为无操作 (no-ops)。
- RSC 渲染通过避免客户端水合作用 (Hydration) 提供更好的性能。
- 组件在两种环境中保持相同的输出。
- 现有代码无需迁移。

#### React Native

对于 React Native 用法，从 `/native` 入口点导入：

```tsx
import Markdown, { compiler, parser, astToNative } from 'markdown-to-jsx/native'
import { View, Text, StyleSheet, Linking } from 'react-native'

const nativeElement = compiler('# 你好世界', {
  styles: {
    heading1: { fontSize: 32, fontWeight: 'bold' },
    paragraph: { marginVertical: 8 },
    link: { color: 'blue', textDecorationLine: 'underline' },
  },
  onLinkPress: url => {
    Linking.openURL(url)
  },
})

const markdown = `# 你好世界

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

**React Native 特定选项：**

- `onLinkPress?: (url: string, title?: string) => void` - 自定义链接点击处理器（默认为 `Linking.openURL`）
- `onLinkLongPress?: (url: string, title?: string) => void` - 链接长按处理器
- `styles?: Partial<Record<NativeStyleKey, StyleProp<ViewStyle | TextStyle | ImageStyle>>>` - 每个元素类型的样式覆盖
- `wrapperProps?: ViewProps | TextProps` - 包装组件的属性（块级元素默认为 `View`，内联元素默认为 `Text`）

**HTML 标签映射：**
HTML 标签会自动映射到 React Native 组件：

- `<img>` → `Image` 组件
- 块级元素 (`<div>`, `<section>`, `<article>`, `<blockquote>`, `<ul>`, `<ol>`, `<li>`, `<table>` 等) → `View` 组件
- 内联元素 (`<span>`, `<strong>`, `<em>`, `<a>` 等) → `Text` 组件
- 类型 1 块 (`<pre>`, `<script>`, `<style>`, `<textarea>`) → `View` 组件

**注意：** 为了更好的可访问性和可发现性，链接默认带有下划线。您可以通过 `styles.link` 选项覆盖此行为。

#### SolidJS

对于 SolidJS 用法，从 `/solid` 入口点导入：

```tsx
import Markdown, {
  compiler,
  parser,
  astToJSX,
  MarkdownProvider,
} from 'markdown-to-jsx/solid'
import { createSignal } from 'solid-js'

// 静态内容
const solidElement = compiler('# 你好世界')

function App() {
  return <Markdown children="# 你好世界" />
}

// 响应式内容 (内容更改时自动更新)
function ReactiveApp() {
  const [content, setContent] = createSignal('# 你好世界')
  return <Markdown>{content}</Markdown>
}

// 或者使用 parser + astToJSX
const ast = parser('# 你好世界')
const solidElement2 = astToJSX(ast)

// 使用 Context 提供默认选项
function AppWithContext() {
  return (
    <MarkdownProvider options={{ sanitizer: customSanitizer }}>
      <Markdown># Content</Markdown>
    </MarkdownProvider>
  )
}
```

**SolidJS 特定功能：**

- **响应式内容**：`Markdown` 组件接受信号 (Signals)/访问器 (Accessors)，以便在 Markdown 内容更改时自动更新。
- **记忆化 (Memoization)**：AST 解析会自动记忆化以获得最佳性能。
- **Context API**：使用 `MarkdownProvider` 提供默认选项，避免属性钻取 (Prop drilling)。

#### Vue.js

对于 Vue.js 3 用法，从 `/vue` 入口点导入：

```tsx
import Markdown, { compiler, parser, astToJSX } from 'markdown-to-jsx/vue'
import { h } from 'vue'

// 使用编译器
const vnode = compiler('# 你好世界')

// 使用组件
<Markdown children="# 你好世界" />

// 或者使用 parser + astToJSX
const ast = parser('# 你好世界')
const vnode2 = astToJSX(ast)
```

**Vue.js 特定功能：**

- **Vue 3 支持**：使用 Vue 3 的 `h()` 渲染函数 API。
- **JSX 支持**：通过 `@vue/babel-plugin-jsx` 或 `@vitejs/plugin-vue-jsx` 支持 Vue 3 JSX。
- **HTML 属性**：使用标准 HTML 属性（使用 `class` 而非 `className`）。
- **组件覆盖**：支持 Options API 和 Composition API 组件。

#### HTML

对于 HTML 字符串输出 (服务端渲染)，从 `/html` 入口点导入：

```tsx
import { compiler, html, parser } from 'markdown-to-jsx/html'

const htmlString = compiler('# 你好世界')

/** 或者使用 parser + html */
const ast = parser('# 你好世界')
const htmlString2 = html(ast)
```

#### Markdown

对于 Markdown 到 Markdown 的编译 (归一化和格式化)，从 `/markdown` 入口点导入：

```typescript
import { compiler, astToMarkdown, parser } from 'markdown-to-jsx/markdown'

const normalizedMarkdown = compiler('# Hello  world\n\nExtra spaces!')

/** 或者使用 AST */
const ast = parser('# Hello  world')
const normalizedMarkdown2 = astToMarkdown(ast)
```

### 库选项 (Library Options)

#### 所有选项

| 选项                            | 类型                          | 默认值  | 说明                                                                                                           |
| :------------------------------ | :---------------------------- | :------ | :------------------------------------------------------------------------------------------------------------- |
| `createElement`                 | `function`                    | -       | 自定义 createElement 行为 (仅限 React/React Native/SolidJS/Vue)。详见 [createElement](#optionscreateelement)。 |
| `disableAutoLink`               | `boolean`                     | `false` | 禁用将裸 URL 自动转换为锚点标签。                                                                              |
| `disableParsingRawHTML`         | `boolean`                     | `false` | 禁用将原始 HTML 解析为 JSX。                                                                                   |
| `enforceAtxHeadings`            | `boolean`                     | `false` | 要求 `#` 与标题文本之间有空格 (符合 GFM 规范)。                                                                |
| `evalUnserializableExpressions` | `boolean`                     | `false` | ⚠️ 计算不可序列化的属性 (危险)。详见 [evalUnserializableExpressions](#optionsevalunserializableexpressions)。  |
| `forceBlock`                    | `boolean`                     | `false` | 强制将所有内容视为块级元素。                                                                                   |
| `forceInline`                   | `boolean`                     | `false` | 强制将所有内容视为内联元素。                                                                                   |
| `forceWrapper`                  | `boolean`                     | `false` | 即使只有单个子元素也强制使用包装器 (仅限 React/React Native/Vue)。详见 [forceWrapper](#optionsforcewrapper)。  |
| `overrides`                     | `object`                      | -       | 覆盖 HTML 标签渲染。详见 [overrides](#optionsoverrides)。                                                      |
| `preserveFrontmatter`           | `boolean`                     | `false` | 在渲染输出中包含 Frontmatter (对于 HTML/JSX 为 `<pre>`，Markdown 则直接包含)。行为因编译器类型而异。           |
| `renderRule`                    | `function`                    | -       | 自定义 AST 规则的渲染。详见 [renderRule](#optionsrenderrule)。                                                 |
| `sanitizer`                     | `function`                    | 内置    | 自定义 URL 清理函数。详见 [sanitizer](#optionssanitizer)。                                                     |
| `slugify`                       | `function`                    | 内置    | 自定义标题 ID 的 Slug 生成。详见 [slugify](#optionsslugify)。                                                  |
| `optimizeForStreaming`          | `boolean`                     | `false` | 抑制不完整 markdown 语法的渲染，适用于流式场景。详见 [流式 Markdown](#流式-markdown)。                         |
| `tagfilter`                     | `boolean`                     | `true`  | 转义危险的 HTML 标签 (`script`, `iframe`, `style` 等) 以防止 XSS。                                             |
| `wrapper`                       | `string \| component \| null` | `'div'` | 多个子元素的包装元素 (仅限 React/React Native/Vue)。详见 [wrapper](#optionswrapper)。                          |
| `wrapperProps`                  | `object`                      | -       | 包装元素的属性 (仅限 React/React Native/Vue)。详见 [wrapperProps](#optionswrapperprops)。                      |

#### options.createElement

有时，您可能想要覆盖 `React.createElement` 的默认行为，以便在渲染 JSX 之前切入渲染过程。这对于添加额外的子元素或根据运行时条件修改某些属性很有用。该函数的参数与 `React.createElement` 一致：[`type, [props], [...children]`](https://reactjs.org/docs/react-api.html#createelement)：

```javascript
import Markdown from 'markdown-to-jsx'
import React from 'react'
import { render } from 'react-dom'

const md = `
# 你好世界
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

#### options.forceWrapper

默认情况下，如果只有一个子元素，编译器不会包装渲染的内容。您可以通过将 `forceWrapper` 设置为 `true` 来更改此设置。如果子元素是内联的，它不一定会被包装在 `span` 中。

```tsx
// 对单个内联子元素使用 `forceWrapper`…
<Markdown options={{ wrapper: 'aside', forceWrapper: true }}>
  Mumble, mumble…
</Markdown>

// 渲染为：

<aside>Mumble, mumble…</aside>
```

#### options.overrides

覆盖 HTML 标签渲染或渲染自定义 React 组件。三种用例：

**1. 移除标签**：返回 `null` 以完全移除标签 (超出 `tagfilter` 的转义范围)：

```tsx
<Markdown options={{ overrides: { iframe: () => null } }}>
  <iframe src="..."></iframe>
</Markdown>
```

**2. 覆盖 HTML 标签**：更改组件、属性或两者：

```tsx
const MyParagraph = ({ children, ...props }) => <div {...props}>{children}</div>

<Markdown options={{ overrides: { h1: { component: MyParagraph, props: { className: 'foo' } } } }}>
  # Hello
</Markdown>

/** 简化用法 */ { overrides: { h1: MyParagraph } }
```

**3. 渲染 React 组件**：在 Markdown 中使用自定义组件：

```tsx
import DatePicker from './date-picker'

const md = `<DatePicker timezone="UTC+5" startTime={1514579720511} />`

<Markdown options={{ overrides: { DatePicker } }}>{md}</Markdown>
```

**重要说明：**

- **JSX 属性会被智能解析** (v9.1+)：
  - 数组和对象：`data={[1, 2, 3]}` → 解析为 `[1, 2, 3]`
  - 布尔值：`enabled={true}` → 解析为 `true`
  - 函数：`onClick={() => ...}` → 出于安全考虑保持为字符串 (使用 [renderRule](#optionsrenderrule) 进行逐例处理，或参阅 [evalUnserializableExpressions](#optionsevalunserializableexpressions))
  - 复杂表达式：`value={someVar}` → 保持为字符串
- 使用 `parser()` 时，原始属性字符串可在 `node.rawAttrs` 中找到。
- 某些属性会被保留：`a` (`href`, `title`)，`img` (`src`, `alt`, `title`)，`input[type="checkbox"]` (`checked`, `readonly`)，`ol` (`start`)，`td`/`th` (`style`)。
- 元素映射：内联文本使用 `span`，内联代码使用 `code`，代码块使用 `pre > code`。

#### options.evalUnserializableExpressions

**⚠️ 安全警告：强烈建议不要用于用户输入的内容**

启用后，尝试计算 JSX 属性中无法序列化为 JSON 的表达式 (函数、变量、复杂表达式)。这使用 `eval()`，可能会执行任意代码。

**默认情况下 (推荐)**，为了安全起见，不可序列化的表达式保持为字符串：

```tsx
import { parser } from 'markdown-to-jsx'

const ast = parser('<Button onClick={() => alert("hi")} />')
// ast[0].attrs.onClick === "() => alert(\"hi\")" (字符串，安全)

// 数组和对象会被自动解析 (无需 eval)：
const ast2 = parser('<Table data={[1, 2, 3]} />')
// ast2[0].attrs.data === [1, 2, 3] (通过 JSON.parse 解析)
```

**仅在以下情况下启用此选项：**

- Markdown 源码是完全可信的 (例如您自己的文档)。
- 您控制所有 JSX 组件及其属性。
- 内容不是用户生成的或用户可编辑的。

**危险示例：**

```tsx
// 包含恶意代码的用户提交的 Markdown
const userMarkdown = '<Component onClick={() => fetch("/admin/delete-all")} />'

// ❌ 危险 - 函数将可执行
parser(userMarkdown, { evalUnserializableExpressions: true })

// ✅ 安全 - 函数保持为字符串
parser(userMarkdown) // 默认行为
```

**安全替代方案：使用 renderRule 进行逐例处理：**

```tsx
// 与其 eval 任意表达式，不如在 renderRule 中选择性地处理它们：
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
      // 选项 1：命名处理器查找 (最安全)
      const handler = handlers[node.attrs.onClick]
      if (handler) {
        return <button onClick={handler}>{/* ... */}</button>
      }

      // 选项 2：带白名单的选择性 eval (仍有风险)
      if (
        node.tag === 'TrustedComponent' &&
        node.attrs.onClick.startsWith('() =>')
      ) {
        try {
          const fn = eval(`(${node.attrs.onClick})`)
          return <button onClick={fn}>{/* ... */}</button>
        } catch (e) {
          // 处理错误
        }
      }
    }
    return next()
  },
})
```

这种方法让您可以完全控制在什么条件下评估哪些表达式。

#### options.renderRule

提供您自己的渲染函数，可以有选择地覆盖规则 (Rules) 的渲染方式 (注意，这与 `options.overrides` 不同，后者在 HTML 标签级别运行且更为通用)。`renderRule` 函数始终在任何其他渲染代码之前执行，让您可以完全控制节点的渲染方式，包括通常被跳过的节点，如 `ref`, `footnote` 和 `frontmatter`。

您可以使用此功能对已建立的 AST 节点执行任何操作；这里有一个选择性覆盖 "codeBlock" 规则以使用 `@matejmazur/react-katex` 库处理 LaTeX 语法的示例：

````tsx
import Markdown, { RuleType } from 'markdown-to-jsx'
import TeX from '@matejmazur/react-katex'

const exampleContent =
  '一些重要公式：\n\n```latex\nmathbb{N} = { a in mathbb{Z} : a > 0 }\n```\n'

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

**访问已解析的 HTML 内容**：对于标记为 `verbatim` (逐字) 的 HTML 块 (如 `<script>`, `<style>`, `<pre>`)，默认渲染器使用 `rawText` 以符合 CommonMark 规范，但 `renderRule` 可以访问 `children` 中完整解析的 AST：

```tsx
<Markdown
  options={{
    renderRule(next, node, renderChildren) {
      if (node.type === RuleType.htmlBlock && node.tag === 'script') {
        // 即使对于逐字块，也可以访问解析后的子节点
        const parsedContent = node.children || []
        // 或者使用 rawText 获取原始内容
        const rawContent = node.rawText || ''

        // 此处为自定义渲染逻辑
        return <CustomScript content={parsedContent} raw={rawContent} />
      }
      return next()
    },
  }}
>
  <script>Hello **world**</script>
</Markdown>
```

#### options.sanitizer

默认提供一个轻量级的 URL 清理 (Sanitizer) 函数，以避免可能放置在例如锚点标签的 `href` 中的常见攻击向量。清理器接收输入、目标 HTML 标签和属性名称。原始函数作为名为 `sanitizer` 的库导出提供。

如果需要，可以通过 `options.sanitizer` 覆盖并替换为自定义清理器：

<!-- prettier-ignore -->
```tsx
// 在这种情况下，sanitizer 将接收：
// ('javascript:alert("foo")', 'a', 'href')

<Markdown options={{ sanitizer: (value, tag, attribute) => value }}>
  {`[foo](javascript:alert("foo"))`}
</Markdown>

// 或者

compiler('[foo](javascript:alert("foo"))', {
  sanitizer: value => value,
})
```

#### options.slugify

默认情况下，使用[轻量级字符规范化函数](https://github.com/quantizor/markdown-to-jsx/blob/bc2f57412332dc670f066320c0f38d0252e0f057/index.js#L261-L275)从标题生成 HTML ID。您可以通过向 `options.slugify` 传递一个函数来覆盖它。当您在标题中使用非字母数字字符 (例如中文或日文字符) 时，这很有用。例如：

<!-- prettier-ignore -->
```tsx
<Markdown options={{ slugify: str => str }}># 中文</Markdown>
compiler('# 中文', { slugify: str => str })
```

原始函数作为名为 `slugify` 的库导出提供。

#### options.wrapper

当有多个子元素要渲染时，编译器默认会将输出包装在 `div` 中。您可以通过将 `wrapper` 选项设置为字符串 (React 元素) 或组件来覆盖此默认设置。

```tsx
const str = '# Heck Yes\n\nThis is great!'

<Markdown options={{ wrapper: 'article' }}>{str}</Markdown>

compiler(str, { wrapper: 'article' })
```

##### 其他有用示例

要获得子元素数组而不使用包装器，请将 `wrapper` 设置为 `null`。这在直接使用 `compiler(…)` 时特别有用。

```tsx
compiler('One\n\nTwo\n\nThree', { wrapper: null })[
  /** 返回 */ ((<p>One</p>), (<p>Two</p>), (<p>Three</p>))
]
```

要在与 `<Markdown>` 相同的 DOM 级别渲染子元素且不使用 HTML 包装器，请将 `wrapper` 设置为 `React.Fragment`。出于渲染目的，这仍会将您的子元素包装在 React 节点中，但包装元素不会显示在 DOM 中。

#### options.wrapperProps

使用 `wrapper` 时应用于包装元素的属性。

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

### 语法高亮 (Syntax highlighting)

使用带有语言注释的[围栏代码块 (Fenced code blocks)](https://www.markdownguide.org/extended-syntax/#syntax-highlighting) 时，该语言将作为 `class="lang-${language}"` 添加到 `<code>` 元素中。为了获得最佳效果，您可以使用 `options.overrides` 提供适当的语法高亮集成，例如下面这个使用 `highlight.js` 的示例：

```html
<!-- 将以下标签添加到页面的 <head> 中以自动加载 hljs 和样式： -->
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

const mdContainingFencedCodeBlock = '```js\nconsole.log("你好世界!");\n```\n'

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

      // hljs 不会重新处理元素，除非移除此属性
      ref.current.removeAttribute('data-highlighted')
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}
````

### 处理短代码 (Handling shortcodes)

对于像 `:smile:` 这样具有任意短代码的 Slack 风格消息，您可以使用 `options.renderRule` 切入纯文本渲染并根据您的喜好进行调整，例如：

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
      {`在一个美丽的夏日，我只想 :smile:。`}
    </Markdown>
  )
}
```

当您使用 `options.renderRule` 时，可以返回任何可渲染的 React JSX，包括图像和 GIF。请务必对您的解决方案进行基准测试，因为 `text` 规则是系统中压力最大的路径之一！

### 流式 Markdown

当渲染增量到达的 Markdown 内容时（例如来自 AI/LLM API、WebSocket 或服务器发送事件），您可能会注意到原始 Markdown 语法在正确渲染之前短暂出现。这是因为像 `**粗体文本` 或 `<CustomComponent>部分内容` 这样的不完整语法在闭合分隔符到达之前被渲染为文本。

`optimizeForStreaming` 选项通过检测不完整的 Markdown 结构并返回 `null`（React）或空字符串（HTML）直到内容完整来解决这个问题：

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

**它抑制的内容：**

- 未闭合的 HTML 标签（`<div>内容` 没有 `</div>`）
- 不完整的标签语法（`<div attr="value` 没有闭合 `>`）
- 未闭合的 HTML 注释（`<!-- 注释` 没有 `-->`）
- 未闭合的行内代码（`` `代码 `` 没有闭合反引号）
- 未闭合的粗体/斜体（`**文本` 或 `*文本` 没有闭合）
- 未闭合的删除线（`~~文本` 没有闭合 `~~`）
- 未闭合的链接（`[文本](url` 没有闭合 `)`）

**正常渲染的内容（流式传输时内容可见）：**

- 围栏代码块 - 内容在到达时显示，等待闭合围栏

### 在 Preact 中使用

一切都会正常工作！只需像您可能已经在做的那样[将 `react` 别名设为 `preact/compat`](https://preactjs.com/guide/v10/switching-to-preact#setting-up-compat) 即可。

### AST 结构解析 (AST Anatomy)

抽象语法树 (AST) 是解析后的 Markdown 的结构化表示。AST 中的每个节点都有一个 `type` 属性来标识其类型，以及特定于类型的属性。

**重要提示：** AST 中的第一个节点通常是 `RuleType.refCollection` 节点，它包含文档中发现的所有参考定义，包括脚注 (以 `^` 为前缀的键存储)。此节点在渲染期间会被跳过，但对于访问参考数据很有用。`compiler()` 和 `astToJSX()` 都会自动从 refCollection 中提取脚注并在 `<footer>` 元素中渲染。

#### 节点类型 (Node Types)

AST 由以下节点类型组成 (使用 `RuleType` 检查节点类型)：

**块级节点 (Block-level nodes)：**

- `RuleType.heading` - 标题 (`# Heading`)
  ```tsx
  { type: RuleType.heading, level: 1, id: "heading", children: [...] }
  ```
- `RuleType.paragraph` - 段落
  ```tsx
  { type: RuleType.paragraph, children: [...] }
  ```
- `RuleType.codeBlock` - 围栏代码块 (```)
  ```tsx
  { type: RuleType.codeBlock, lang: "javascript", text: "code content" }
  ```
- `RuleType.blockQuote` - 引用 (`>`)
  ```tsx
  { type: RuleType.blockQuote, children: [...], alert?: "note" }
  ```
- `RuleType.orderedList` / `RuleType.unorderedList` - 列表
  ```tsx
  { type: RuleType.orderedList, items: [[...]], start?: 1 }
  { type: RuleType.unorderedList, items: [[...]] }
  ```
- `RuleType.table` - 表格
  ```tsx
  { type: RuleType.table, header: [...], cells: [[...]], align: [...] }
  ```
- `RuleType.htmlBlock` - HTML 块和 JSX 组件

  ```tsx
  {
    type: RuleType.htmlBlock,
    tag: "div",
    attrs: {},
    rawAttrs?: string,
    children?: ASTNode[],
    verbatim?: boolean,
    rawText?: string,
    text?: string // @deprecated - 改用 rawText
  }
  ```

  **注意 (v9.1+)：** 在开始/结束标签之间有空行的 JSX 组件现在可以正确嵌套子组件，而不是创建兄弟节点。

  **HTML 块解析 (v9.2+)：** 即使标记为 `verbatim`，HTML 块也始终会被完整解析到 `children` 属性中。`verbatim` 标志作为渲染提示 (默认渲染器对逐字块使用 `rawText` 以保持 CommonMark 规范)，但 `renderRule` 实现可以访问所有 HTML 块中 `children` 里的完整 AST。`rawText` 字段包含逐字块的原始 HTML 内容，而 `rawAttrs` 包含原始属性字符串。

**内联节点 (Inline nodes)：**

- `RuleType.text` - 纯文本
  ```tsx
  { type: RuleType.text, text: "你好世界" }
  ```
- `RuleType.textFormatted` - 加粗、斜体等
  ```tsx
  { type: RuleType.textFormatted, tag: "strong", children: [...] }
  ```
- `RuleType.codeInline` - 内联代码 (`` ` ``)
  ```tsx
  { type: RuleType.codeInline, text: "code" }
  ```
- `RuleType.link` - 链接
  ```tsx
  { type: RuleType.link, target: "https://example.com", children: [...] }
  ```
- `RuleType.image` - 图像
  ```tsx
  { type: RuleType.image, target: "image.png", alt: "description" }
  ```

**其他节点：**

- `RuleType.breakLine` - 硬换行 (`  `)
- `RuleType.breakThematic` - 分隔线 (`---`)
- `RuleType.gfmTask` - GFM 任务列表项 (`- [ ]`)
- `RuleType.ref` - 参考定义节点 (不渲染，存储在 refCollection 中)
- `RuleType.refCollection` - 参考定义集合 (出现在 AST 根部，包括带 `^` 前缀的脚注)
- `RuleType.footnote` - 脚注定义节点 (不渲染，存储在 refCollection 中)
- `RuleType.footnoteReference` - 脚注引用 (`[^identifier]`)
- `RuleType.frontmatter` - YAML Frontmatter 块
  ```tsx
  { type: RuleType.frontmatter, text: "---\ntitle: My Title\n---" }
  ```
- `RuleType.htmlComment` - HTML 注释节点
  ```tsx
  { type: RuleType.htmlComment, text: "<!-- comment -->" }
  ```
- `RuleType.htmlSelfClosing` - 自闭合 HTML 标签
  ```tsx
  { type: RuleType.htmlSelfClosing, tag: "img", attrs: { src: "image.png" } }
  ```

**JSX 属性解析 (v9.1+)：**

解析器会智能解析 JSX 属性值：

- 数组/对象通过 `JSON.parse()` 解析：`rows={[["a", "b"]]}` → `attrs.rows = [["a", "b"]]`
- 出于安全考虑，函数保持为字符串：`onClick={() => ...}` → `attrs.onClick = "() => ..."`
- 布尔值会被解析：`enabled={true}` → `attrs.enabled = true`
- 原始属性字符串保存在 `rawAttrs` 字段中

#### AST 结构示例

````tsx
import { parser, RuleType } from 'markdown-to-jsx'

const ast = parser(`# Hello World

This is a **paragraph** with [a link](https://example.com).

[linkref]: https://example.com

```javascript
console.log('code')
```

`)

// AST 结构：
[
  // 参考集合 (如果存在参考，则为第一个节点)
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

#### 类型检查

使用 `RuleType` 枚举来标识 AST 节点：

```tsx
import { RuleType } from 'markdown-to-jsx'

if (node.type === RuleType.heading) {
  const heading = node as MarkdownToJSX.HeadingNode
  console.log(`标题级别 ${heading.level}: ${heading.id}`)
}
```

**何时使用 `compiler` vs `parser` vs `<Markdown>`：**

- 当您需要一个简单的 React 组件来将 Markdown 渲染为 JSX 时，请使用 `<Markdown>`。
- 当您需要从 Markdown 获取 React JSX 输出时，请使用 `compiler` (组件内部使用它)。
- 当您在渲染为 JSX 之前需要 AST 进行自定义处理，或者只需要 AST 本身时，请使用 `parser` + `astToJSX`。

### 注意事项 (Gotchas)

**JSX 属性解析 (v9.1+)**：JSX 属性中的数组和对象会被自动解析：

<!-- prettier-ignore -->
```tsx
// 在 Markdown 中：
<Table
  columns={['Name', 'Age']}
  data={[
    ['Alice', 30],
    ['Bob', 25],
  ]}
/>

// 在您的组件中 (v9.1+)：
const Table = ({ columns, data, ...props }) => {
  // columns 已经是一个数组：["Name", "Age"]
  // data 已经是一个数组：[["Alice", 30], ["Bob", 25]]
  // 无需 JSON.parse！
}

// 为了向后兼容，请检查类型：
const Table = ({ columns, data, ...props }) => {
  const parsedColumns =
    typeof columns === 'string' ? JSON.parse(columns) : columns
  const parsedData = typeof data === 'string' ? JSON.parse(data) : data
}
```

**函数属性保持为字符串**以确保安全。使用 [renderRule](#optionsrenderrule) 进行逐例处理，或参阅 [evalUnserializableExpressions](#optionsevalunserializableexpressions) 了解如何选择性启用 eval。

**HTML 缩进**：HTML 块中的前导空格会根据第一行的缩进自动修剪，以避免 Markdown 语法冲突。

**HTML 中的代码**：不要直接在 HTML div 中放置代码。请改用围栏代码块：

````md
<div>
```js
var code = here();
```
</div>
````

## 更新日志 (Changelog)

参阅 [Github Releases](https://github.com/quantizor/markdown-to-jsx/releases)。

## 捐赠 (Donate)

喜欢这个库吗？它完全是在志愿服务的基础上开发的；如果您可以的话，请通过 [Sponsor 链接](https://github.com/sponsors/quantizor)捐赠几美元！
