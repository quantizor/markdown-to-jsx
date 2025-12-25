const n=`# 这是 Markdown

✨ 您可以编辑我！✨

[Markdown](http://daringfireball.net/projects/markdown/) 让您可以用非常自然的方式编写内容。

- 您可以创建列表，就像这个一样
- 让内容变得 **加粗** 或 _倾斜_
- 嵌入 \`代码\` 片段
- 创建 [链接](/)
- ...

<small>示例内容感谢借自 [elm-markdown](http://elm-lang.org/examples/markdown) ❤️</small>

> [!Tip]
> 支持普通引用和 "Alert" 引用。如果需要更多控制，可以使用 \`renderRule\`。提供 \`.markdown-alert-[type]\` 类作为样式挂钩。

可以通过 [\`renderRule\` 选项](https://github.com/quantizor/markdown-to-jsx#optionsrenderrule)对代码块 (或任何规则！) 进行自定义处理。例如，通过 [\`@matejmazur/react-katex\`](https://www.npmjs.com/package/@matejmazur/react-katex) 支持 LaTeX：

\`\`\`latex
\\mathbb{N} = \\{ a \\in \\mathbb{Z} : a > 0 \\}
\`\`\`

或者任何其他典型语言，使用 [\`highlight.js\`](https://highlightjs.org/)：

\`\`\`javascript
function App() {
  return <div>你好世界!</div>
}
\`\`\`

如果您在 [\`overrides\` 选项](https://github.com/quantizor/markdown-to-jsx/blob/main/README.md#optionsoverrides---rendering-arbitrary-react-components)中声明了自定义 React 组件，您甚至可以包含它们。

<MyComponent>这难道不 _酷_ 吗？</MyComponent>
`;export{n as default};
