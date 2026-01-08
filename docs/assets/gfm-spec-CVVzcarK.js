const n=`---
title: GitHub Flavored Markdown Spec
version: 0.29
date: '2019-04-06'
license: '[CC-BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/)'
---

# 介绍 (Introduction)

## 什么是 GitHub Flavored Markdown？ (What is GitHub Flavored Markdown?)

GitHub Flavored Markdown (通常简称为 GFM) 是目前 GitHub.com 和 GitHub Enterprise 上的用户内容所支持的 Markdown 方言。

本正式规范基于 CommonMark 规范，定义了该方言的语法和语义。

GFM 是 CommonMark 的严格超集。所有 GitHub 用户内容支持但原始 CommonMark 规范中未指定的特性均被称为**扩展 (Extensions)**，并被相应地突出显示。

虽然 GFM 支持广泛的输入，但值得注意的是，GitHub.com 和 GitHub Enterprise 在将 GFM 转换为 HTML 后会执行额外的后处理和清理 (Sanitization)，以确保网站的安全性和一致性。

## 什么是 Markdown？ (What is Markdown?)

Markdown 是一种用于编写结构化文档的纯文本格式，基于电子邮件和新闻组帖子中指示格式的惯例。它由 John Gruber (在 Aaron Swartz 的帮助下) 开发，并于 2004 年以[语法描述 (Syntax description)](http://daringfireball.net/projects/markdown/syntax)和用于将 Markdown 转换为 HTML 的 Perl 脚本 (\`Markdown.pl\`) 的形式发布。在接下来的十年中，出现了数十种用多种语言编写的实现。有些通过脚注、表格和其他文档元素的惯例扩展了原始 Markdown 语法。有些允许将 Markdown 文档渲染为 HTML 以外的格式。像 Reddit、StackOverflow 和 GitHub 这样的网站有数百万人在使用 Markdown。Markdown 开始被用于网络之外，用于撰写书籍、文章、演示文稿、信件和讲义。

Markdown 与许多其他轻量级标记语法 (通常更易于编写) 的区别在于它的可读性。正如 Gruber 所写：

> Markdown 格式语法的压倒性设计目标是使其尽可能易读。其理念是，Markdown 格式的文档应该能够以纯文本形式原样发布，而看起来不像被标记了标签或格式说明。
> (<http://daringfireball.net/projects/markdown/>)

这一观点可以通过将 [AsciiDoc](http://www.methods.co.nz/asciidoc/) 样本与等效的 Markdown 样本进行比较来阐明。以下是 AsciiDoc 手册中的一个 AsciiDoc 样本：

\`\`\`
1. 列表项一。
+
列表项一继续，第二段后跟
缩进块。
+
.................
$ ls *.sh
$ mv *.sh ~/tmp
.................
+
列表项继续，第三段。

2. 列表项二继续，开放块。
+
--
此段落是前面列表项的一部分。

a. 此列表是嵌套的，不需要显式项
续行。
+
此段落是前面列表项的一部分。

b. 列表项 b。

此段落属于外层列表的项二。
--
\`\`\`

以下是 Markdown 中的等效内容：

\`\`\`
1.  列表项一。

    列表项一继续，第二段后跟
    缩进块。

        $ ls *.sh
        $ mv *.sh ~/tmp

    列表项继续，第三段。

2.  列表项二继续，开放块。

    此段落是前面列表项的一部分。

    1. 此列表是嵌套的，不需要显式项续行。

       此段落是前面列表项的一部分。

    2. 列表项 b。

    此段落属于外层列表的项二。
\`\`\`

可以说，AsciiDoc 版本更容易编写。您不需要担心缩进。但 Markdown 版本更易于阅读。在源文件中，列表项的嵌套对肉眼来说是显而易见的，而不仅仅是在处理后的文档中。

## 为什么需要规范？ (Why is a spec needed?)

John Gruber 对 [Markdown 语法的权威描述](http://daringfireball.net/projects/markdown/syntax) 并没有明确指定语法。以下是它没有回答的一些问题示例：

1.  子列表需要多少缩进？规范说明续行段落需要缩进四个空格，但对子列表并未完全明确。自然会认为子列表也必须缩进四个空格，但 \`Markdown.pl\` 并不要求如此。这绝非"边缘情况"，不同实现在此问题上的差异常常让用户在实际文档中感到意外。（参见 [John Gruber 的这条评论](https://web.archive.org/web/20170611172104/http://article.gmane.org/gmane.text.markdown.general/1997)。）

2.  块引用或标题前需要空行吗？大多数实现不要求空行。然而，这可能导致硬换行文本中的意外结果，以及解析歧义（注意某些实现将标题放在块引用内，而另一些则不会）。（John Gruber 也表达过[支持要求空行](https://web.archive.org/web/20170611172104/http://article.gmane.org/gmane.text.markdown.general/2146)的观点。）

3.  缩进代码块前需要空行吗？（\`Markdown.pl\` 要求，但文档中未提及，某些实现不要求。）

    \`\`\`markdown
    段落
    代码？
    \`\`\`

4.  确定列表项何时被包裹在 \`<p>\` 标签中的确切规则是什么？列表可以部分"宽松"、部分"紧凑"吗？这样的列表应该如何处理？

    \`\`\`markdown
    1. 一

    2. 二
    3. 三
    \`\`\`

    或者这个？

    \`\`\`markdown
    1.  一
        - a

        - b

    2.  二
    \`\`\`

    （John Gruber [在此](https://web.archive.org/web/20170611172104/http://article.gmane.org/gmane.text.markdown.general/2554)有一些相关评论。）

5.  列表标记可以缩进吗？有序列表标记可以右对齐吗？

    \`\`\`markdown
    8.  项目 1
    9.  项目 2
    10. 项目 2a
    \`\`\`

6.  这是一个在第二项中带有分隔线的列表，还是由分隔线分隔的两个列表？

    \`\`\`markdown
    - a

    ---

    - b
    \`\`\`

7.  当列表标记从数字变成项目符号时，是两个列表还是一个？（Markdown 语法描述暗示是两个，但 Perl 脚本和许多其他实现产生的是一个。）

    \`\`\`markdown
    1. 甲
    2. 乙

    - 丙
    - 丁
    \`\`\`

8.  内联结构标记的优先级规则是什么？例如，以下内容是有效链接，还是代码跨度优先？

    \`\`\`markdown
    [一个反引号 (\`)](/url) 和 [另一个反引号 (\`)](/url)。
    \`\`\`

9.  强调和加粗标记的优先级规则是什么？例如，以下内容应如何解析？

    \`\`\`markdown
    *foo *bar* baz*
    \`\`\`

10. 块级结构和内联结构之间的优先级规则是什么？例如，以下内容应如何解析？

    \`\`\`markdown
    - \`长代码跨度可以包含这样的连字符
      - 这可能会破坏内容\`
    \`\`\`

11. 列表项可以包含章节标题吗？（\`Markdown.pl\` 不允许，但允许块引用包含标题。）

    \`\`\`markdown
    - # 标题
    \`\`\`

12. 列表项可以为空吗？

    \`\`\`markdown
    - a
    -
    - b
    \`\`\`

13. 链接引用可以在块引用或列表项内定义吗？

    \`\`\`markdown
    > Blockquote [foo].
    >
    > [foo]: /url
    \`\`\`

14. 如果同一引用有多个定义，哪个优先？

    \`\`\`markdown
    [foo]: /url1
    [foo]: /url2

    [foo][]
    \`\`\`

在没有规范的情况下，早期实现者参考 \`Markdown.pl\` 来解决这些歧义。但 \`Markdown.pl\` 有很多错误，在许多情况下会产生明显糟糕的结果，因此它不能令人满意地替代规范。

由于没有明确的规范，各实现之间的差异相当大。因此，用户常常惊讶地发现，在一个系统（比如 GitHub wiki）上以一种方式渲染的文档，在另一个系统上（比如使用 pandoc 转换为 docbook）渲染结果不同。更糟糕的是，由于 Markdown 中没有所谓的"语法错误"，这种差异通常不会立即被发现。

## 关于本文档 (About this document)

本文档试图明确指定 Markdown 语法。它包含许多并排展示 Markdown 和 HTML 的示例。这些示例同时用作一致性测试。附带的脚本 \`spec_tests.py\` 可用于针对任何 Markdown 程序运行测试：

    python test/spec_tests.py --spec spec.txt --program PROGRAM

由于本文档描述了如何将 Markdown 解析为抽象语法树，使用语法树的抽象表示而非 HTML 似乎更合理。但 HTML 能够表示我们需要做出的结构区分，而且选择 HTML 进行测试使得无需编写抽象语法树渲染器即可针对实现运行测试。

本文档由文本文件 \`spec.txt\` 生成，该文件使用 Markdown 编写，并对并排测试做了小幅扩展。脚本 \`tools/makespec.py\` 可用于将 \`spec.txt\` 转换为 HTML 或 CommonMark（然后可以转换为其他格式）。

在示例中，\`→\` 字符用于表示制表符。

# 预备知识 (Preliminaries)

## 字符和行 (Characters and lines)

任何 [字符] 序列都是有效的 CommonMark 文档。

[字符](@) 是一个 Unicode 代码点。虽然某些代码点（例如组合重音符号）在直观意义上不对应于字符，但为了本规范的目的，所有代码点都算作字符。

本规范不指定编码；它认为行是由 [字符] 组成的，而不是字节。符合规范的解析器可能仅限于某种编码。

[行](@) 是零个或多个 [字符] 的序列，不包括换行符 (\`U+000A\`) 或回车符 (\`U+000D\`)，后面跟着一个 [行尾] 或文件末尾。

[行尾](@) 是一个换行符 (\`U+000A\`)，一个后面不跟换行符的回车符 (\`U+000D\`)，或者一个回车符后面跟着一个换行符。

不包含字符的行，或仅包含空格 (\`U+0020\`) 或制表符 (\`U+0009\`) 的行，称为 [空行](@)。

本规范将使用以下字符类定义：

[空白字符](@) 是空格 (\`U+0020\`)、制表符 (\`U+0009\`)、换行符 (\`U+000A\`)、垂直制表符 (\`U+000B\`)、换页符 (\`U+000C\`) 或回车符 (\`U+000D\`)。

[空白](@) 是一个或多个 [空白字符] 的序列。

[Unicode 空白字符](@) 是 Unicode \`Zs\` 一般类别中的任何代码点，或制表符 (\`U+0009\`)、回车符 (\`U+000D\`)、换行符 (\`U+000A\`) 或换页符 (\`U+000C\`)。

[Unicode 空白](@) 是一个或多个 [Unicode 空白字符] 的序列。

[空格](@) 是 \`U+0020\`。

[非空白字符](@) 是任何不是 [空白字符] 的字符。

[ASCII 标点字符](@) 是 \`!\`, \`"\`, \`#\`, \`$\`, \`%\`, \`&\`, \`'\`, \`(\`, \`)\`, \`*\`, \`+\`, \`,\`, \`-\`, \`.\`, \`/\` (U+0021–2F), \`:\`, \`;\`, \`<\`, \`=\`, \`>\`, \`?\`, \`@\` (U+003A–0040), \`[\`, \`\\\`, \`]\`, \`^\`, \`_\`, \`\` \` \`\` (U+005B–0060), \`{\`, \`|\`, \`}\`, 或 \`~\` (U+007B–007E)。

[标点字符](@) 是 [ASCII 标点字符] 或一般 Unicode 类别 \`Pc\`, \`Pd\`, \`Pe\`, \`Pf\`, \`Pi\`, \`Po\`, 或 \`Ps\` 中的任何字符。

## 制表符 (Tabs)

行中的制表符不会扩展为 [空格]。但是，在空白有助于定义块结构的上下文中，制表符的行为就像它们被替换为制表位为 4 个字符的空格一样。

因此，例如，在缩进代码块中可以使用一个制表符代替四个空格。（但是请注意，内部制表符作为文字制表符传递，不会扩展为空格。）

\`\`\`example
→foo→baz→→bim
.
<pre><code>foo→baz→→bim
</code></pre>
\`\`\`

\`\`\`example
  →foo→baz→→bim
.
<pre><code>foo→baz→→bim
</code></pre>
\`\`\`

\`\`\`example
    a→a
    ὐ→a
.
<pre><code>a→a
ὐ→a
</code></pre>
\`\`\`

在下面的示例中，列表项的续行段落使用制表符缩进；这与使用四个空格缩进的效果完全相同：

\`\`\`example
  - foo

→bar
.
<ul>
<li>
<p>foo</p>
<p>bar</p>
</li>
</ul>
\`\`\`

\`\`\`example
- foo

→→bar
.
<ul>
<li>
<p>foo</p>
<pre><code>  bar
</code></pre>
</li>
</ul>
\`\`\`

通常，开始块引用的 \`>\` 字符后面可以跟一个可选的空格，该空格不被视为内容的一部分。在下面的情况中，\`>\` 后面跟着一个制表符，它被视为扩展为三个空格。由于这些空格中的一个被视为定界符的一部分，\`foo\` 被认为在块引用上下文中缩进了六个空格，因此我们得到一个以两个空格开头的缩进代码块。

\`\`\`example
>→→foo
.
<blockquote>
<pre><code>  foo
</code></pre>
</blockquote>
\`\`\`

\`\`\`example
-→→foo
.
<ul>
<li>
<pre><code>  foo
</code></pre>
</li>
</ul>
\`\`\`

\`\`\`example
    foo
→bar
.
<pre><code>foo
bar
</code></pre>
\`\`\`

\`\`\`example
 - foo
   - bar
→ - baz
.
<ul>
<li>foo
<ul>
<li>bar
<ul>
<li>baz</li>
</ul>
</li>
</ul>
</li>
</ul>
\`\`\`

\`\`\`example
#→Foo
.
<h1>Foo</h1>
\`\`\`

\`\`\`example
*→*→*→
.
<hr />
\`\`\`

## 不安全字符 (Insecure characters)

出于安全原因，Unicode 字符 \`U+0000\` 必须替换为替换字符 (\`U+FFFD\`)。

# 块和内联 (Blocks and inlines)

我们可以将文档视为 [块](@) 的序列——诸如段落、引用、列表、标题、分隔线和代码块之类的结构元素。有些块（如引用和列表项）包含其他块；其他块（如标题和段落）包含 [内联](@) 内容——文本、链接、强调文本、图像、代码跨度等。

## 优先级 (Precedence)

块结构的指示符总是优先于内联结构的指示符。因此，例如，以下是一个包含两个项目的列表，而不是一个包含代码跨度的项目的列表：

\`\`\`example
- \`one
- two\`
.
<ul>
<li>\`one</li>
<li>two\`</li>
</ul>
\`\`\`

这意味着解析可以分两步进行：首先，识别文档的块结构；其次，可以解析段落、标题和其他块结构内的文本行以获取内联结构。第二步需要有关链接引用定义的信息，这些信息只有在第一步结束时才可用。请注意，第一步需要按顺序处理行，但第二步可以并行化，因为一个块元素的内联解析不会影响任何其他块元素的内联解析。

## 容器块和叶子块 (Container blocks and leaf blocks)

我们可以将块分为两种类型：[容器块](@)，它可以包含其他块，以及 [叶子块](@)，它不能包含其他块。

# 叶子块 (Leaf blocks)

本节描述构成 Markdown 文档的不同种类的叶子块。

## 分隔线 (Thematic breaks)

一行由 0-3 个空格的缩进，后跟三个或更多匹配的 \`-\`、\`_\` 或 \`*\` 字符序列（每个字符后面可选地跟任意数量的空格或制表符）组成，形成一个 [分隔线](@)。

\`\`\`example
***
---
___
.
<hr />
<hr />
<hr />
\`\`\`

错误的字符：

\`\`\`example
+++
.
<p>+++</p>
\`\`\`

\`\`\`example
===
.
<p>===</p>
\`\`\`

字符数量不足：

\`\`\`example
--
**
__
.
<p>--
**
__</p>
\`\`\`

允许一到三个空格的缩进：

\`\`\`example
 ***
  ***
   ***
.
<hr />
<hr />
<hr />
\`\`\`

四个空格太多了：

\`\`\`example
    ***
.
<pre><code>***
</code></pre>
\`\`\`

\`\`\`example
Foo
    ***
.
<p>Foo
***</p>
\`\`\`

可以使用三个以上的字符：

\`\`\`example
_____________________________________
.
<hr />
\`\`\`

字符之间允许有空格：

\`\`\`example
 - - -
.
<hr />
\`\`\`

\`\`\`example
 **  * ** * ** * **
.
<hr />
\`\`\`

\`\`\`example
-     -      -      -
.
<hr />
\`\`\`

末尾允许有空格：

\`\`\`example
- - - -
.
<hr />
\`\`\`

但是，该行不能出现其他字符：

\`\`\`example
_ _ _ _ a

a------

---a---
.
<p>_ _ _ _ a</p>
<p>a------</p>
<p>---a---</p>
\`\`\`

要求所有 [非空白字符] 都相同。因此，这不是分隔线：

\`\`\`example
 *-*
.
<p><em>-</em></p>
\`\`\`

分隔线前后不需要空行：

\`\`\`example
- foo
***
- bar
.
<ul>
<li>foo</li>
</ul>
<hr />
<ul>
<li>bar</li>
</ul>
\`\`\`

分隔线可以中断段落：

\`\`\`example
Foo
***
bar
.
<p>Foo</p>
<hr />
<p>bar</p>
\`\`\`

如果一行破折号满足上述成为分隔线的条件，但也可以被解释为 [setext 标题] 的下划线，则优先解释为 [setext 标题]。因此，例如，这是一个 setext 标题，而不是段落后跟分隔线：

\`\`\`example
Foo
---
bar
.
<h2>Foo</h2>
<p>bar</p>
\`\`\`

当分隔线和列表项都是一行的可能解释时，分隔线优先：

\`\`\`example
* Foo
* * *
* Bar
.
<ul>
<li>Foo</li>
</ul>
<hr />
<ul>
<li>Bar</li>
</ul>
\`\`\`

如果您想在列表项中使用分隔线，请使用不同的项目符号：

\`\`\`example
- Foo
- * * *
.
<ul>
<li>Foo</li>
<li>
<hr />
</li>
</ul>
\`\`\`

## ATX 标题 (ATX headings)

[ATX 标题](@) 由一串字符组成，解析为内联内容，位于 1-6 个未转义的 \`#\` 字符的开启序列和任意数量未转义的 \`#\` 字符的可选关闭序列之间。\`#\` 字符的开启序列后面必须跟 [空格] 或行尾。可选的 \`#\` 关闭序列前面必须有 [空格]，后面只能跟空格。开启的 \`#\` 字符可以缩进 0-3 个空格。标题的原始内容在被解析为内联内容之前会去除前导和尾随空格。标题级别等于开启序列中 \`#\` 字符的数量。

简单标题：

\`\`\`example
# foo
## foo
### foo
#### foo
##### foo
###### foo
.
<h1>foo</h1>
<h2>foo</h2>
<h3>foo</h3>
<h4>foo</h4>
<h5>foo</h5>
<h6>foo</h6>
\`\`\`

超过六个 \`#\` 字符就不是标题了：

\`\`\`example
####### foo
.
<p>####### foo</p>
\`\`\`

\`#\` 字符和标题内容之间至少需要一个空格，除非标题为空。请注意，许多实现目前不要求空格。然而，[原始 ATX 实现](http://www.aaronsw.com/2002/atx/atx.py) 要求空格，它有助于防止以下内容被解析为标题：

\`\`\`example
#5 bolt

#hashtag
.
<p>#5 bolt</p>
<p>#hashtag</p>
\`\`\`

这不是标题，因为第一个 \`#\` 被转义了：

\`\`\`example
\\## foo
.
<p>## foo</p>
\`\`\`

内容被解析为内联：

\`\`\`example
# foo *bar* \\*baz\\*
.
<h1>foo <em>bar</em> *baz*</h1>
\`\`\`

在解析内联内容时，前导和尾随 [空白] 被忽略：

\`\`\`example
#                  foo
.
<h1>foo</h1>
\`\`\`

允许一到三个空格的缩进：

\`\`\`example
 ### foo
  ## foo
   # foo
.
<h3>foo</h3>
<h2>foo</h2>
<h1>foo</h1>
\`\`\`

四个空格太多了：

\`\`\`example
    # foo
.
<pre><code># foo
</code></pre>
\`\`\`

\`\`\`example
foo
    # bar
.
<p>foo
# bar</p>
\`\`\`

\`#\` 字符的关闭序列是可选的：

\`\`\`example
## foo ##
  ###   bar    ###
.
<h2>foo</h2>
<h3>bar</h3>
\`\`\`

它不需要与开启序列的长度相同：

\`\`\`example
# foo ##################################
##### foo ##
.
<h1>foo</h1>
<h5>foo</h5>
\`\`\`

结束序列后允许有空格：

\`\`\`example
### foo ###
.
<h3>foo</h3>
\`\`\`

\`#\` 字符序列后面跟着除 [空格] 以外的任何内容都不是关闭序列，而是被视为标题内容的一部分：

\`\`\`example
### foo ### b
.
<h3>foo ### b</h3>
\`\`\`

关闭序列前面必须有一个空格：

\`\`\`example
# foo#
.
<h1>foo#</h1>
\`\`\`

反斜杠转义的 \`#\` 字符不算作关闭序列的一部分：

\`\`\`example
### foo \\###
## foo #\\##
# foo \\#
.
<h3>foo ###</h3>
<h2>foo ###</h2>
<h1>foo #</h1>
\`\`\`

ATX 标题不需要用空行与周围内容分隔，它们可以中断段落：

\`\`\`example
****
## foo
****
.
<hr />
<h2>foo</h2>
<hr />
\`\`\`

\`\`\`example
Foo bar
# baz
Bar foo
.
<p>Foo bar</p>
<h1>baz</h1>
<p>Bar foo</p>
\`\`\`

ATX 标题可以为空：

\`\`\`example
##
#
### ###
.
<h2></h2>
<h1></h1>
<h3></h3>
\`\`\`

## Setext 标题 (Setext headings)

[setext 标题](@) 由一行或多行文本组成，每行至少包含一个 [非空白字符]，缩进不超过 3 个空格，后面跟着一个 [setext 标题下划线]。文本行必须满足：如果它们后面没有 setext 标题下划线，它们将被解释为段落：它们不能被解释为 [代码围栏]、[ATX 标题][ATX headings]、[块引用][block quotes]、[分隔线][thematic breaks]、[列表项][list items] 或 [HTML 块][HTML blocks]。

[setext 标题下划线](@) 是 \`=\` 字符序列或 \`-\` 字符序列，缩进不超过 3 个空格，并可以有任意数量的尾随空格或制表符。

如果 [setext 标题下划线] 使用 \`=\` 字符，则标题是 1 级标题；如果使用 \`-\` 字符，则是 2 级标题。标题的内容是将前面的文本行解析为 CommonMark 内联内容的结果。

通常，setext 标题前后不需要空行。但是，它不能中断段落，因此当 setext 标题出现在段落之后时，它们之间需要一个空行。

简单示例：

\`\`\`example
Foo *bar*
=========

Foo *bar*
---------
.
<h1>Foo <em>bar</em></h1>
<h2>Foo <em>bar</em></h2>
\`\`\`

标题的内容可以跨越多行：

\`\`\`example
Foo *bar
baz*
====
.
<h1>Foo <em>bar
baz</em></h1>
\`\`\`

内容是将标题的原始内容解析为内联的结果。标题的原始内容是通过连接各行并删除初始和最终 [空白] 形成的。

\`\`\`example
  Foo *bar
baz*→
====
.
<h1>Foo <em>bar
baz</em></h1>
\`\`\`

下划线可以是任意长度：

\`\`\`example
Foo
-------------------------

Foo
=
.
<h2>Foo</h2>
<h1>Foo</h1>
\`\`\`

标题内容可以缩进最多三个空格，并且不需要与下划线对齐：

\`\`\`example
   Foo
---

  Foo
-----

  Foo
  ===
.
<h2>Foo</h2>
<h2>Foo</h2>
<h1>Foo</h1>
\`\`\`

四个空格的缩进太多了：

\`\`\`example
    Foo
    ---

    Foo
---
.
<pre><code>Foo
---

Foo
</code></pre>
<hr />
\`\`\`

setext 标题下划线可以缩进最多三个空格，并可以有尾随空格：

\`\`\`example
Foo
   ----
.
<h2>Foo</h2>
\`\`\`

四个空格太多了：

\`\`\`example
Foo
    ---
.
<p>Foo
---</p>
\`\`\`

setext 标题下划线不能包含内部空格：

\`\`\`example
Foo
= =

Foo
--- -
.
<p>Foo
= =</p>
<p>Foo</p>
<hr />
\`\`\`

内容行中的尾随空格不会导致换行：

\`\`\`example
Foo
-----
.
<h2>Foo</h2>
\`\`\`

末尾的反斜杠也不会：

\`\`\`example
Foo\\
----
.
<h2>Foo\\</h2>
\`\`\`

由于块结构的指示符优先于内联结构的指示符，以下是 setext 标题：

\`\`\`example
\`Foo
----
\`

<a title="很多
---
破折号"/>
.
<h2>\`Foo</h2>
<p>\`</p>
<h2>&lt;a title=&quot;很多</h2>
<p>破折号&quot;/&gt;</p>
\`\`\`

setext 标题下划线不能是列表项或块引用中的 [惰性续行行]：

\`\`\`example
> Foo
---
.
<blockquote>
<p>Foo</p>
</blockquote>
<hr />
\`\`\`

\`\`\`example
> foo
bar
===
.
<blockquote>
<p>foo
bar
===</p>
</blockquote>
\`\`\`

\`\`\`example
- Foo
---
.
<ul>
<li>Foo</li>
</ul>
<hr />
\`\`\`

段落和后面的 setext 标题之间需要空行，否则段落会成为标题内容的一部分：

\`\`\`example
Foo
Bar
---
.
<h2>Foo
Bar</h2>
\`\`\`

但通常，setext 标题前后不需要空行：

\`\`\`example
---
Foo
---
Bar
---
Baz
.
<hr />
<h2>Foo</h2>
<h2>Bar</h2>
<p>Baz</p>
\`\`\`

Setext 标题不能为空：

\`\`\`example

====
.
<p>====</p>
\`\`\`

Setext 标题文本行不能被解释为段落以外的块结构。因此，这些示例中的破折号行被解释为分隔线：

\`\`\`example
---
---
.
<hr />
<hr />
\`\`\`

\`\`\`example
- foo
-----
.
<ul>
<li>foo</li>
</ul>
<hr />
\`\`\`

\`\`\`example
    foo
---
.
<pre><code>foo
</code></pre>
<hr />
\`\`\`

\`\`\`example
> foo
-----
.
<blockquote>
<p>foo</p>
</blockquote>
<hr />
\`\`\`

如果您想要一个字面文本为 \`> foo\` 的标题，可以使用反斜杠转义：

\`\`\`example
\\> foo
------
.
<h2>&gt; foo</h2>
\`\`\`

**兼容性注意：** 大多数现有的 Markdown 实现不允许 setext 标题的文本跨越多行。但对于如何解释以下内容没有达成共识：

\`\`\`markdown
Foo
bar

---

baz
\`\`\`

可以找到四种不同的解释：

1. 段落 "Foo"，标题 "bar"，段落 "baz"
2. 段落 "Foo bar"，分隔线，段落 "baz"
3. 段落 "Foo bar --- baz"
4. 标题 "Foo bar"，段落 "baz"

我们认为解释 4 最自然，解释 4 通过允许多行标题增加了 CommonMark 的表达能力。想要解释 1 的作者可以在第一个段落后放一个空行：

\`\`\`example
Foo

bar
---
baz
.
<p>Foo</p>
<h2>bar</h2>
<p>baz</p>
\`\`\`

想要解释 2 的作者可以在分隔线周围放置空行：

\`\`\`example
Foo
bar

---

baz
.
<p>Foo
bar</p>
<hr />
<p>baz</p>
\`\`\`

或使用不能算作 [setext 标题下划线] 的分隔线，例如：

\`\`\`example
Foo
bar
* * *
baz
.
<p>Foo
bar</p>
<hr />
<p>baz</p>
\`\`\`

想要解释 3 的作者可以使用反斜杠转义：

\`\`\`example
Foo
bar
\\---
baz
.
<p>Foo
bar
---
baz</p>
\`\`\`

## 缩进代码块 (Indented code blocks)

[缩进代码块](@) 由一个或多个通过空行分隔的 [缩进块] 组成。[缩进块](@) 是一系列非空行，每行缩进四个或更多空格。代码块的内容是行的字面内容，包括尾随 [行尾]，减去四个空格的缩进。缩进代码块没有 [info 字符串]。

缩进代码块不能中断段落，因此段落和后面的缩进代码块之间必须有一个空行。(但是，代码块和后面的段落之间不需要空行。)

\`\`\`example
    一个简单的
      缩进代码块
.
<pre><code>一个简单的
  缩进代码块
</code></pre>
\`\`\`

如果缩进的解释在代码块和表示材料属于 [列表项][list items] 之间存在歧义，列表项的解释优先：

\`\`\`example
  - foo

    bar
.
<ul>
<li>
<p>foo</p>
<p>bar</p>
</li>
</ul>
\`\`\`

\`\`\`example
1.  foo

    - bar
.
<ol>
<li>
<p>foo</p>
<ul>
<li>bar</li>
</ul>
</li>
</ol>
\`\`\`

代码块的内容是字面文本，不会被解析为 Markdown：

\`\`\`example
    <a/>
    *嗨*

    - 一
.
<pre><code>&lt;a/&gt;
*嗨*

- 一
</code></pre>
\`\`\`

这里我们有三个由空行分隔的块：

\`\`\`example
    块1

    块2



    块3
.
<pre><code>块1

块2



块3
</code></pre>
\`\`\`

超过四个空格的任何初始空格都将包含在内容中，即使在内部空行中也是如此：

\`\`\`example
    块1

      块2
.
<pre><code>块1

  块2
</code></pre>
\`\`\`

缩进代码块不能中断段落。(这允许悬挂缩进等。)

\`\`\`example
Foo
    bar

.
<p>Foo
bar</p>
\`\`\`

但是，任何前导空格少于四个的非空行会立即结束代码块。因此段落可以紧跟在缩进代码之后：

\`\`\`example
    foo
bar
.
<pre><code>foo
</code></pre>
<p>bar</p>
\`\`\`

缩进代码可以紧接在其他类型的块之前和之后：

\`\`\`example
# 标题
    foo
标题
------
    foo
----
.
<h1>标题</h1>
<pre><code>foo
</code></pre>
<h2>标题</h2>
<pre><code>foo
</code></pre>
<hr />
\`\`\`

第一行可以缩进超过四个空格：

\`\`\`example
        foo
    bar
.
<pre><code>    foo
bar
</code></pre>
\`\`\`

缩进代码块前后的空行不包含在其中：

\`\`\`example


    foo


.
<pre><code>foo
</code></pre>
\`\`\`

代码块内容中包含尾随空格：

\`\`\`example
    foo
.
<pre><code>foo
</code></pre>
\`\`\`

## 围栏代码块 (Fenced code blocks)

[代码围栏](@) 是至少三个连续反引号字符 (\`\` \` \`\`) 或波浪号 (\`~\`) 的序列。(波浪号和反引号不能混用。) [围栏代码块](@) 以代码围栏开始，缩进不超过三个空格。

包含开启代码围栏的行可以选择性地包含代码围栏后面的一些文本；这些文本会去除前导和尾随空白并称为 [info 字符串](@)。如果 [info 字符串] 出现在反引号围栏之后，它不能包含任何反引号字符。(这个限制的原因是，否则某些内联代码会被错误地解释为围栏代码块的开始。)

代码块的内容包括所有后续行，直到与代码块开始时相同类型 (反引号或波浪号) 的关闭 [代码围栏]，并且至少与开启代码围栏具有相同数量的反引号或波浪号。如果前导代码围栏缩进了 N 个空格，则从内容的每一行 (如果存在) 中删除最多 N 个空格的缩进。(如果内容行未缩进，则保持不变。如果它缩进少于 N 个空格，则删除所有缩进。)

关闭代码围栏可以缩进最多三个空格，后面只能跟空格，这些空格将被忽略。如果到达包含块 (或文档) 的末尾且未找到关闭代码围栏，则代码块包含开启代码围栏之后的所有行，直到包含块 (或文档) 的末尾。(另一种规范会要求在未找到关闭代码围栏时进行回溯。但这使解析效率大大降低，而这里描述的行为似乎没有真正的缺点。)

围栏代码块可以中断段落，前后都不需要空行。

代码围栏的内容被视为字面文本，不会被解析为内联。[info 字符串] 的第一个词通常用于指定代码样本的语言，并在 \`code\` 标签的 \`class\` 属性中渲染。但是，本规范不强制对 [info 字符串] 进行任何特定处理。

这是一个使用反引号的简单示例：

\`\`\`\`example
\`\`\`
<
 >
\`\`\`
.
<pre><code>&lt;
 &gt;
</code></pre>
\`\`\`\`

使用波浪号：

\`\`\`example
~~~
<
 >
~~~
.
<pre><code>&lt;
 &gt;
</code></pre>
\`\`\`

少于三个反引号是不够的：

\`\`\`example
\`\`
foo
\`\`
.
<p><code>foo</code></p>
\`\`\`

关闭代码围栏必须使用与开启围栏相同的字符：

\`\`\`\`example
\`\`\`
aaa
~~~
\`\`\`
.
<pre><code>aaa
~~~
</code></pre>
\`\`\`\`

\`\`\`\`example
~~~
aaa
\`\`\`
~~~
.
<pre><code>aaa
\`\`\`
</code></pre>
\`\`\`\`

关闭代码围栏必须至少与开启围栏一样长：

\`\`\`\`\`\`\`example
\`\`\`\`
aaa
\`\`\`
\`\`\`\`\`\`
.
<pre><code>aaa
\`\`\`
</code></pre>
\`\`\`\`\`\`\`

\`\`\`example
~~~~
aaa
~~~
~~~~
.
<pre><code>aaa
~~~
</code></pre>
\`\`\`

未关闭的代码块在文档末尾 (或封闭的 [块引用][block quotes] 或 [列表项][list items]) 关闭：

\`\`\`\`example
\`\`\`
.
<pre><code></code></pre>
\`\`\`\`

\`\`\`\`\`\`example
\`\`\`\`\`

\`\`\`
aaa
.
<pre><code>
\`\`\`
aaa
</code></pre>
\`\`\`\`\`\`

\`\`\`\`example
> \`\`\`
> aaa

bbb
.
<blockquote>
<pre><code>aaa
</code></pre>
</blockquote>
<p>bbb</p>
\`\`\`\`

代码块可以将所有空行作为其内容：

\`\`\`\`example
\`\`\`


\`\`\`
.
<pre><code>

</code></pre>
\`\`\`\`

代码块可以为空：

\`\`\`\`example
\`\`\`
\`\`\`
.
<pre><code></code></pre>
\`\`\`\`

围栏可以缩进。如果开启围栏缩进，内容行将删除等效的开启缩进 (如果存在)：

\`\`\`\`example
 \`\`\`
 aaa
aaa
\`\`\`
.
<pre><code>aaa
aaa
</code></pre>
\`\`\`\`

\`\`\`\`example
  \`\`\`
aaa
  aaa
aaa
  \`\`\`
.
<pre><code>aaa
aaa
aaa
</code></pre>
\`\`\`\`

\`\`\`\`example
   \`\`\`
   aaa
    aaa
  aaa
   \`\`\`
.
<pre><code>aaa
 aaa
aaa
</code></pre>
\`\`\`\`

四个空格的缩进会产生缩进代码块：

\`\`\`\`example
    \`\`\`
    aaa
    \`\`\`
.
<pre><code>\`\`\`
aaa
\`\`\`
</code></pre>
\`\`\`\`

关闭围栏可以缩进 0-3 个空格，其缩进不需要与开启围栏匹配：

\`\`\`\`example
\`\`\`
aaa
  \`\`\`
.
<pre><code>aaa
</code></pre>
\`\`\`\`

\`\`\`\`example
   \`\`\`
aaa
  \`\`\`
.
<pre><code>aaa
</code></pre>
\`\`\`\`

这不是结束围栏，因为它缩进了 4 个空格：

\`\`\`\`example
\`\`\`
aaa
    \`\`\`
.
<pre><code>aaa
    \`\`\`
</code></pre>
\`\`\`\`

代码围栏 (开启和关闭) 不能包含内部空格：

\`\`\`\`example
\`\`\` \`\`\`
aaa
.
<p><code> </code>
aaa</p>
\`\`\`\`

\`\`\`example
~~~~~~
aaa
~~~ ~~
.
<pre><code>aaa
~~~ ~~
</code></pre>
\`\`\`

围栏代码块可以中断段落，并可以直接后跟段落，中间不需要空行：

\`\`\`\`example
foo
\`\`\`
bar
\`\`\`
baz
.
<p>foo</p>
<pre><code>bar
</code></pre>
<p>baz</p>
\`\`\`\`

其他块也可以在围栏代码块之前和之后出现，中间不需要空行：

\`\`\`example
foo
---
~~~
bar
~~~
# baz
.
<h2>foo</h2>
<pre><code>bar
</code></pre>
<h1>baz</h1>
\`\`\`

可以在开启代码围栏之后提供 [info 字符串]。虽然本规范不强制对 info 字符串进行任何特定处理，但第一个词通常用于指定代码块的语言。在 HTML 输出中，语言通常通过向 \`code\` 元素添加由 \`language-\` 后跟语言名称组成的类来表示。

\`\`\`\`example
\`\`\`ruby
def foo(x)
  return 3
end
\`\`\`
.
<pre><code class="language-ruby">def foo(x)
  return 3
end
</code></pre>
\`\`\`\`

\`\`\`example
~~~~    ruby startline=3 $%@#$
def foo(x)
  return 3
end
~~~~~~~
.
<pre><code class="language-ruby">def foo(x)
  return 3
end
</code></pre>
\`\`\`

\`\`\`\`\`example
\`\`\`\`;
\`\`\`\`
.
<pre><code class="language-;"></code></pre>
\`\`\`\`\`

反引号代码块的 [Info 字符串] 不能包含反引号：

\`\`\`\`example
\`\`\` aa \`\`\`
foo
.
<p><code>aa</code>
foo</p>
\`\`\`\`

波浪号代码块的 [Info 字符串] 可以包含反引号和波浪号：

\`\`\`\`example
~~~ aa \`\`\` ~~~
foo
~~~
.
<pre><code class="language-aa">foo
</code></pre>
\`\`\`\`

关闭代码围栏不能有 [info 字符串]：

\`\`\`\`example
\`\`\`
\`\`\` aaa
\`\`\`
.
<pre><code>\`\`\` aaa
</code></pre>
\`\`\`\`

## HTML 块 (HTML blocks)

[HTML 块](@) 是被视为原始 HTML 的一组行 (在 HTML 输出中不会被转义)。

有七种 [HTML 块]，可以通过它们的开始和结束条件来定义。块以满足 [开始条件](@) 的行开始 (在最多三个空格的可选缩进之后)。它以满足匹配 [结束条件](@) 的第一个后续行结束，或文档的最后一行，或包含当前 HTML 块的 [容器块](#container-blocks) 的最后一行 (如果没有遇到满足 [结束条件] 的行)。如果第一行同时满足 [开始条件] 和 [结束条件]，则块将仅包含该行。

1.  **开始条件 (Start condition)：** 行以字符串 \`<script\`、\`<pre\` 或 \`<style\`（不区分大小写）开头，后跟空白、字符串 \`>\` 或行尾。\\
    **结束条件 (End condition)：** 行包含结束标签 \`<\/script>\`、\`</pre>\` 或 \`</style>\`（不区分大小写；不需要与开始标签匹配）。

2.  **开始条件：** 行以字符串 \`<!--\` 开头。\\
    **结束条件：** 行包含字符串 \`-->\`。

3.  **开始条件：** 行以字符串 \`<?\` 开头。\\
    **结束条件：** 行包含字符串 \`?>\`。

4.  **开始条件：** 行以字符串 \`<!\` 开头，后跟一个大写 ASCII 字母。\\
    **结束条件：** 行包含字符 \`>\`。

5.  **开始条件：** 行以字符串 \`<![CDATA[\` 开头。\\
    **结束条件：** 行包含字符串 \`]]>\`。

6.  **开始条件：** 行以字符串 \`<\` 或 \`</\` 开头，后跟以下字符串之一（不区分大小写）：\`address\`、\`article\`、\`aside\`、\`base\`、\`basefont\`、\`blockquote\`、\`body\`、\`caption\`、\`center\`、\`col\`、\`colgroup\`、\`dd\`、\`details\`、\`dialog\`、\`dir\`、\`div\`、\`dl\`、\`dt\`、\`fieldset\`、\`figcaption\`、\`figure\`、\`footer\`、\`form\`、\`frame\`、\`frameset\`、\`h1\`、\`h2\`、\`h3\`、\`h4\`、\`h5\`、\`h6\`、\`head\`、\`header\`、\`hr\`、\`html\`、\`iframe\`、\`legend\`、\`li\`、\`link\`、\`main\`、\`menu\`、\`menuitem\`、\`nav\`、\`noframes\`、\`ol\`、\`optgroup\`、\`option\`、\`p\`、\`param\`、\`section\`、\`summary\`、\`table\`、\`tbody\`、\`td\`、\`tfoot\`、\`th\`、\`thead\`、\`title\`、\`tr\`、\`track\`、\`ul\`，后跟 [空白]、行尾、字符串 \`>\` 或字符串 \`/>\`。\\
    **结束条件：** 行后跟 [空行]。

7.  **开始条件：** 行以完整的 [开启标签]（[标签名称] 为除 \`script\`、\`style\` 或 \`pre\` 之外的任何标签）或完整的 [关闭标签] 开头，后面只跟 [空白] 或行尾。\\
    **结束条件：** 行后跟 [空行]。

HTML 块会持续到被适当的 [结束条件] 关闭，或文档的最后一行或其他 [容器块](#container-blocks)。这意味着 **HTML 块内的** 任何 HTML，如果在其他情况下可能被识别为开始条件，将被解析器忽略并按原样传递，而不改变解析器的状态。

例如，由 \`<table>\` 开始的 HTML 块内的 \`<pre>\` 不会影响解析器状态；由于 HTML 块是由开始条件 6 开始的，它将在任何空行处结束。这可能令人惊讶：

\`\`\`example
<table><tr><td>
<pre>
**你好**,

_世界_.
</pre>
</td></tr></table>
.
<table><tr><td>
<pre>
**你好**,
<p><em>世界</em>.
</pre></p>
</td></tr></table>
\`\`\`

在这种情况下，HTML 块被换行符终止 — \`**你好**\` 文本保持原样 — 然后恢复常规解析，接下来是段落、强调的 \`世界\` 以及内联和块 HTML。

除类型 7 外的所有类型的 [HTML 块] 都可以中断段落。类型 7 的块不能中断段落。(此限制旨在防止将换行段落内的长标签误解释为开始 HTML 块。)

以下是一些简单的示例。这里是一些基本的类型 6 HTML 块：

\`\`\`example
<table>
  <tr>
    <td>
           hi
    </td>
  </tr>
</table>

好的。
.
<table>
  <tr>
    <td>
           hi
    </td>
  </tr>
</table>
<p>好的。</p>
\`\`\`

\`\`\`example
 <div>
  *你好*
         <foo><a>
.
 <div>
  *你好*
         <foo><a>
\`\`\`

块也可以以关闭标签开始：

\`\`\`example
</div>
*foo*
.
</div>
*foo*
\`\`\`

这里我们有两个 HTML 块，中间有一个 Markdown 段落：

\`\`\`example
<DIV CLASS="foo">

*Markdown*

</DIV>
.
<DIV CLASS="foo">
<p><em>Markdown</em></p>
</DIV>
\`\`\`

第一行上的标签可以是部分的，只要它在会有空白的地方分割：

\`\`\`example
<div id="foo"
  class="bar">
</div>
.
<div id="foo"
  class="bar">
</div>
\`\`\`

\`\`\`example
<div id="foo" class="bar
  baz">
</div>
.
<div id="foo" class="bar
  baz">
</div>
\`\`\`

开启标签不需要关闭：

\`\`\`example
<div>
*foo*

*bar*
.
<div>
*foo*
<p><em>bar</em></p>
\`\`\`

部分标签甚至不需要完成 (垃圾进，垃圾出)：

\`\`\`example
<div id="foo"
*嗨*
.
<div id="foo"
*嗨*
\`\`\`

\`\`\`example
<div class
foo
.
<div class
foo
\`\`\`

初始标签甚至不需要是有效标签，只要它以标签的形式开始：

\`\`\`example
<div *???-&&&-<---
*foo*
.
<div *???-&&&-<---
*foo*
\`\`\`

在类型 6 块中，初始标签不需要单独占一行：

\`\`\`example
<div><a href="bar">*foo*</a></div>
.
<div><a href="bar">*foo*</a></div>
\`\`\`

\`\`\`example
<table><tr><td>
foo
</td></tr></table>
.
<table><tr><td>
foo
</td></tr></table>
\`\`\`

直到下一个空行或文档末尾的所有内容都包含在 HTML 块中。因此，在下面的示例中，看起来像 Markdown 代码块的内容实际上是 HTML 块的一部分，它会持续到空行或文档末尾：

\`\`\`\`example
<div></div>
\`\`\` c
int x = 33;
\`\`\`
.
<div></div>
\`\`\` c
int x = 33;
\`\`\`
\`\`\`\`

要用 _不在_ (6) 中的块级标签列表中的标签开始 [HTML 块]，您必须将标签单独放在第一行 (并且它必须是完整的)：

\`\`\`example
<a href="foo">
*bar*
</a>
.
<a href="foo">
*bar*
</a>
\`\`\`

在类型 7 块中，[标签名称] 可以是任何内容：

\`\`\`example
<Warning>
*bar*
</Warning>
.
<Warning>
*bar*
</Warning>
\`\`\`

\`\`\`example
<i class="foo">
*bar*
</i>
.
<i class="foo">
*bar*
</i>
\`\`\`

\`\`\`example
</ins>
*bar*
.
</ins>
*bar*
\`\`\`

这些规则旨在允许我们使用可以用作块级或内联级标签的标签。\`<del>\` 标签是一个很好的例子。我们可以用三种不同的方式用 \`<del>\` 标签包围内容。在这种情况下，我们得到一个原始 HTML 块，因为 \`<del>\` 标签单独占一行：

\`\`\`example
<del>
*foo*
</del>
.
<del>
*foo*
</del>
\`\`\`

在这种情况下，我们得到一个仅包含 \`<del>\` 标签的原始 HTML 块 (因为它以后面的空行结束)。因此内容被解释为 CommonMark：

\`\`\`example
<del>

*foo*

</del>
.
<del>
<p><em>foo</em></p>
</del>
\`\`\`

最后，在这种情况下，\`<del>\` 标签被解释为 CommonMark 段落 _内部_ 的 [原始 HTML]。(因为标签不是单独占一行，我们得到的是内联 HTML 而不是 [HTML 块]。)

\`\`\`example
<del>*foo*</del>
.
<p><del><em>foo</em></del></p>
\`\`\`

设计用于包含字面内容的 HTML 标签 (\`script\`、\`style\`、\`pre\`)、注释、处理指令和声明的处理方式有所不同。这些块不是在第一个空行处结束，而是在包含相应结束标签的第一行处结束。因此，这些块可以包含空行：

pre 标签 (类型 1)：

\`\`\`example
<pre language="haskell"><code>
import Text.HTML.TagSoup

main :: IO ()
main = print $ parseTags tags
</code></pre>
好的
.
<pre language="haskell"><code>
import Text.HTML.TagSoup

main :: IO ()
main = print $ parseTags tags
</code></pre>
<p>好的</p>
\`\`\`

script 标签 (类型 1)：

\`\`\`example
<script type="text/javascript">
// JavaScript 示例

document.getElementById("demo").innerHTML = "你好 JavaScript！";
<\/script>
好的
.
<script type="text/javascript">
// JavaScript 示例

document.getElementById("demo").innerHTML = "你好 JavaScript！";
<\/script>
<p>好的</p>
\`\`\`

style 标签 (类型 1)：

\`\`\`example
<style
  type="text/css">
h1 {color:red;}

p {color:blue;}
</style>
好的
.
<style
  type="text/css">
h1 {color:red;}

p {color:blue;}
</style>
<p>好的</p>
\`\`\`

如果没有匹配的结束标签，块将在文档末尾 (或封闭的 [块引用][block quotes] 或 [列表项][list items]) 结束：

\`\`\`example
<style
  type="text/css">

foo
.
<style
  type="text/css">

foo
\`\`\`

\`\`\`example
> <div>
> foo

bar
.
<blockquote>
<div>
foo
</blockquote>
<p>bar</p>
\`\`\`

\`\`\`example
- <div>
- foo
.
<ul>
<li>
<div>
</li>
<li>foo</li>
</ul>
\`\`\`

结束标签可以与开始标签在同一行：

\`\`\`example
<style>p{color:red;}</style>
*foo*
.
<style>p{color:red;}</style>
<p><em>foo</em></p>
\`\`\`

\`\`\`example
<!-- foo -->*bar*
*baz*
.
<!-- foo -->*bar*
<p><em>baz</em></p>
\`\`\`

请注意，在最后一行上的结束标签将包含在 [HTML 块] 中：

\`\`\`example
<script>
foo
<\/script>1. *bar*
.
<script>
foo
<\/script>1. *bar*
\`\`\`

注释 (类型 2)：

\`\`\`example
<!-- Foo

bar
   baz -->
好的
.
<!-- Foo

bar
   baz -->
<p>好的</p>
\`\`\`

处理指令 (类型 3)：

\`\`\`example
<?php

  echo '>';

?>
好的
.
<?php

  echo '>';

?>
<p>好的</p>
\`\`\`

声明 (类型 4)：

\`\`\`example
<!DOCTYPE html>
.
<!DOCTYPE html>
\`\`\`

CDATA (类型 5)：

\`\`\`example
<![CDATA[
function matchwo(a,b)
{
  if (a < b && a < 0) then {
    return 1;

  } else {

    return 0;
  }
}
]]>
好的
.
<![CDATA[
function matchwo(a,b)
{
  if (a < b && a < 0) then {
    return 1;

  } else {

    return 0;
  }
}
]]>
<p>好的</p>
\`\`\`

开启标签可以缩进 1-3 个空格，但不能是 4 个：

\`\`\`example
  <!-- foo -->

    <!-- foo -->
.
  <!-- foo -->
<pre><code>&lt;!-- foo --&gt;
</code></pre>
\`\`\`

\`\`\`example
  <div>

    <div>
.
  <div>
<pre><code>&lt;div&gt;
</code></pre>
\`\`\`

类型 1-6 的 HTML 块可以中断段落，前面不需要空行。

\`\`\`example
Foo
<div>
bar
</div>
.
<p>Foo</p>
<div>
bar
</div>
\`\`\`

但是，需要有后续的空行，除非在文档末尾，并且除了类型 1-5 的块，[如上][HTML block]：

\`\`\`example
<div>
bar
</div>
*foo*
.
<div>
bar
</div>
*foo*
\`\`\`

类型 7 的 HTML 块不能中断段落：

\`\`\`example
Foo
<a href="bar">
baz
.
<p>Foo
<a href="bar">
baz</p>
\`\`\`

此规则与 John Gruber 的原始 Markdown 语法规范不同，后者说：

> 唯一的限制是块级 HTML 元素——
> 例如 \`<div>\`、\`<table>\`、\`<pre>\`、\`<p>\` 等——必须通过空行与
> 周围内容分隔，并且块的开始和结束标签不应该用制表符或空格缩进。

在某些方面，Gruber 的规则比这里给出的更严格：

- 它要求 HTML 块前面有一个空行。
- 它不允许开始标签缩进。
- 它需要一个匹配的结束标签，并且也不允许缩进。

大多数 Markdown 实现 (包括 Gruber 自己的一些实现) 都不遵守所有这些限制。

然而，Gruber 的规则在一个方面比这里给出的更自由，因为它允许 HTML 块内出现空行。这里不允许空行有两个原因。首先，它消除了解析平衡标签的需要，这很昂贵，并且如果找不到匹配的结束标签，可能需要从文档末尾回溯。其次，它提供了一种非常简单灵活的方式在 HTML 标签内包含 Markdown 内容：只需使用空行将 Markdown 与 HTML 分隔开：

比较：

\`\`\`example
<div>

*强调* 文本。

</div>
.
<div>
<p><em>强调</em> 文本。</p>
</div>
\`\`\`

\`\`\`example
<div>
*强调* 文本。
</div>
.
<div>
*强调* 文本。
</div>
\`\`\`

一些 Markdown 实现采用了一种约定，如果开启标签具有属性 \`markdown=1\`，则将标签内的内容解释为文本。上面给出的规则似乎是实现相同表达能力的更简单、更优雅的方式，并且解析起来也简单得多。

主要的潜在缺点是不能再以 100% 的可靠性将 HTML 块粘贴到 Markdown 文档中。然而，_在大多数情况下_ 这会工作得很好，因为 HTML 中的空行通常后跟 HTML 块标签。例如：

\`\`\`example
<table>

<tr>

<td>
嗨
</td>

</tr>

</table>
.
<table>
<tr>
<td>
嗨
</td>
</tr>
</table>
\`\`\`

然而，如果内部标签被缩进 _并且_ 用空格分隔，则会出现问题，因为它们将被解释为缩进代码块：

\`\`\`example
<table>

  <tr>

    <td>
      嗨
    </td>

  </tr>

</table>
.
<table>
  <tr>
<pre><code>&lt;td&gt;
  嗨
&lt;/td&gt;
</code></pre>
  </tr>
</table>
\`\`\`

幸运的是，空行通常不是必需的，可以删除。例外是在 \`<pre>\` 标签内，但如 [上文][HTML blocks] 所述，以 \`<pre>\` 开头的原始 HTML 块 _可以_ 包含空行。

## 链接引用定义 (Link reference definitions)

[链接引用定义](@) 由 [链接标签] 组成，缩进最多三个空格，后跟冒号 (\`:\`)、可选的 [空白] (包括最多一个 [行尾])、[链接目标]、可选的 [空白] (包括最多一个 [行尾]) 和可选的 [链接标题]，如果存在，必须通过 [空白] 与 [链接目标] 分隔。该行上不能再出现 [非空白字符]。

[链接引用定义] 不对应于文档的结构元素。相反，它定义了一个标签，可以在文档中其他地方的 [引用链接] 和引用样式的 [图像] 中使用。[链接引用定义] 可以在使用它们的链接之前或之后。

\`\`\`example
[foo]: /url "title"

[foo]
.
<p><a href="/url" title="title">foo</a></p>
\`\`\`

\`\`\`example
   [foo]:
      /url
           '标题'

[foo]
.
<p><a href="/url" title="标题">foo</a></p>
\`\`\`

\`\`\`example
[Foo*bar\\]]:my_(url) '标题（带括号）'

[Foo*bar\\]]
.
<p><a href="my_(url)" title="标题（带括号）">Foo*bar]</a></p>
\`\`\`

\`\`\`example
[Foo bar]:
<my url>
'title'

[Foo bar]
.
<p><a href="my%20url" title="title">Foo bar</a></p>
\`\`\`

标题可以跨越多行：

\`\`\`example
[foo]: /url '
title
line1
line2
'

[foo]
.
<p><a href="/url" title="
title
line1
line2
">foo</a></p>
\`\`\`

但是，它不能包含 [空行]：

\`\`\`example
[foo]: /url '标题

带空行'

[foo]
.
<p>[foo]: /url '标题</p>
<p>带空行'</p>
<p>[foo]</p>
\`\`\`

标题可以省略：

\`\`\`example
[foo]:
/url

[foo]
.
<p><a href="/url">foo</a></p>
\`\`\`

链接目标不能省略：

\`\`\`example
[foo]:

[foo]
.
<p>[foo]:</p>
<p>[foo]</p>
\`\`\`

但是，可以使用尖括号指定空的链接目标：

\`\`\`example
[foo]: <>

[foo]
.
<p><a href="">foo</a></p>
\`\`\`

标题必须通过空白与链接目标分隔：

\`\`\`example
[foo]: <bar>(baz)

[foo]
.
<p>[foo]: <bar>(baz)</p>
<p>[foo]</p>
\`\`\`

标题和目标都可以包含反斜杠转义和字面反斜杠：

\`\`\`example
[foo]: /url\\bar\\*baz "foo\\"bar\\baz"

[foo]
.
<p><a href="/url%5Cbar*baz" title="foo&quot;bar\\baz">foo</a></p>
\`\`\`

链接可以出现在其相应定义之前：

\`\`\`example
[foo]

[foo]: url
.
<p><a href="url">foo</a></p>
\`\`\`

如果有多个匹配的定义，第一个优先：

\`\`\`example
[foo]

[foo]: first
[foo]: second
.
<p><a href="first">foo</a></p>
\`\`\`

如 [Links] 部分所述，标签的匹配不区分大小写 (参见 [matches])。

\`\`\`example
[FOO]: /url

[Foo]
.
<p><a href="/url">Foo</a></p>
\`\`\`

\`\`\`example
[ΑΓΩ]: /φου

[αγω]
.
<p><a href="/%CF%86%CE%BF%CF%85">αγω</a></p>
\`\`\`

这是一个没有对应链接的链接引用定义。
它对文档没有任何贡献。

\`\`\`example
[foo]: /url
.
\`\`\`

这是另一个示例：

\`\`\`example
[
foo
]: /url
bar
.
<p>bar</p>
\`\`\`

这不是链接引用定义，因为标题后有
[非空白字符]：

\`\`\`example
[foo]: /url "title" ok
.
<p>[foo]: /url &quot;title&quot; ok</p>
\`\`\`

这是一个链接引用定义，但它没有标题：

\`\`\`example
[foo]: /url
"title" ok
.
<p>&quot;title&quot; ok</p>
\`\`\`

这不是链接引用定义，因为它被缩进了
四个空格：

\`\`\`example
    [foo]: /url "title"

[foo]
.
<pre><code>[foo]: /url &quot;title&quot;
</code></pre>
<p>[foo]</p>
\`\`\`

这不是链接引用定义，因为它出现在
代码块中：

\`\`\`\`example
\`\`\`
[foo]: /url
\`\`\`

[foo]
.
<pre><code>[foo]: /url
</code></pre>
<p>[foo]</p>
\`\`\`\`

[链接引用定义] 不能中断段落。

\`\`\`example
Foo
[bar]: /baz

[bar]
.
<p>Foo
[bar]: /baz</p>
<p>[bar]</p>
\`\`\`

但是，它可以直接跟在其他块级元素后面，例如标题和分隔线，后面不需要空行。

\`\`\`example
# [Foo]
[foo]: /url
> bar
.
<h1><a href="/url">Foo</a></h1>
<blockquote>
<p>bar</p>
</blockquote>
\`\`\`

\`\`\`example
[foo]: /url
bar
===
[foo]
.
<h1>bar</h1>
<p><a href="/url">foo</a></p>
\`\`\`

\`\`\`example
[foo]: /url
===
[foo]
.
<p>===
<a href="/url">foo</a></p>
\`\`\`

多个 [链接引用定义] 可以一个接一个地出现，中间不需要空行。

\`\`\`example
[foo]: /foo-url "foo"
[bar]: /bar-url
  "bar"
[baz]: /baz-url

[foo],
[bar],
[baz]
.
<p><a href="/foo-url" title="foo">foo</a>,
<a href="/bar-url" title="bar">bar</a>,
<a href="/baz-url">baz</a></p>
\`\`\`

[链接引用定义] 可以出现在块容器内，如列表和块引用。它们影响整个文档，而不仅仅是定义它们的容器：

\`\`\`example
[foo]

> [foo]: /url
.
<p><a href="/url">foo</a></p>
<blockquote>
</blockquote>
\`\`\`

某事物是否为 [链接引用定义] 与其定义的链接引用是否在文档中使用无关。因此，例如，以下文档仅包含一个链接引用定义，没有可见内容：

\`\`\`example
[foo]: /url
.
\`\`\`

## 段落 (Paragraphs)

不能被解释为其他类型块的非空行序列形成 [段落](@)。段落的内容是将段落的原始内容解析为内联的结果。段落的原始内容是通过连接各行并删除初始和最终 [空白] 形成的。

两个段落的简单示例：

\`\`\`example
aaa

bbb
.
<p>aaa</p>
<p>bbb</p>
\`\`\`

段落可以包含多行，但不能有空行：

\`\`\`example
aaa
bbb

ccc
ddd
.
<p>aaa
bbb</p>
<p>ccc
ddd</p>
\`\`\`

段落之间的多个空行没有影响：

\`\`\`example
aaa


bbb
.
<p>aaa</p>
<p>bbb</p>
\`\`\`

前导空格被跳过：

\`\`\`example
  aaa
 bbb
.
<p>aaa
bbb</p>
\`\`\`

第一行之后的行可以缩进任意数量，因为缩进代码块不能中断段落。

\`\`\`example
aaa
             bbb
                                       ccc
.
<p>aaa
bbb
ccc</p>
\`\`\`

但是，第一行最多可以缩进三个空格，否则会触发缩进代码块：

\`\`\`example
   aaa
bbb
.
<p>aaa
bbb</p>
\`\`\`

\`\`\`example
    aaa
bbb
.
<pre><code>aaa
</code></pre>
<p>bbb</p>
\`\`\`

在内联解析之前，最终空格会被去除，因此以两个或更多空格结尾的段落不会以 [硬换行] 结尾：

\`\`\`example
aaa
bbb
.
<p>aaa<br />
bbb</p>
\`\`\`

## 空行 (Blank lines)

块级元素之间的 [空行] 被忽略，除了它们在确定 [列表] 是 [紧凑] 还是 [宽松] 方面的作用。

文档开头和结尾的空行也被忽略。

\`\`\`example


aaa


# aaa


.
<p>aaa</p>
<h1>aaa</h1>
\`\`\`

<div class="extension">

## 表格（扩展）(Tables (extension))

GFM 启用了 \`table\` 扩展，提供了额外的叶子块类型。

[表格](@) 是包含行和列的数据排列，由单个标题行、将标题与数据分隔的 [分隔符行] 以及零个或多个数据行组成。

每行由包含任意文本的单元格组成，其中解析 [内联]，由竖线 (\`|\`) 分隔。为了阅读清晰，建议使用前导和尾随竖线，并且如果存在解析歧义。竖线和单元格内容之间的空格会被修剪。块级元素不能插入到表格中。

[分隔符行](@) 由单元格组成，其唯一内容是连字符 (\`-\`)，可选地包含前导或尾随冒号 (\`:\`)，或两者都有，分别表示左对齐、右对齐或居中对齐。

\`\`\`example table
| foo | bar |
| --- | --- |
| baz | bim |
.
<table>
<thead>
<tr>
<th>foo</th>
<th>bar</th>
</tr>
</thead>
<tbody>
<tr>
<td>baz</td>
<td>bim</td>
</tr>
</tbody>
</table>
\`\`\`

一列中的单元格不需要匹配长度，尽管如果匹配会更容易阅读。同样，前导和尾随竖线的使用可能不一致：

\`\`\`example table
| abc | defghi |
:-: | -----------:
bar | baz
.
<table>
<thead>
<tr>
<th align="center">abc</th>
<th align="right">defghi</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center">bar</td>
<td align="right">baz</td>
</tr>
</tbody>
</table>
\`\`\`

通过转义在单元格内容中包含竖线，包括在其他内联跨度内：

\`\`\`example table
| f\\|oo  |
| ------ |
| b \`\\|\` az |
| b **\\|** im |
.
<table>
<thead>
<tr>
<th>f|oo</th>
</tr>
</thead>
<tbody>
<tr>
<td>b <code>|</code> az</td>
</tr>
<tr>
<td>b <strong>|</strong> im</td>
</tr>
</tbody>
</table>
\`\`\`

表格在第一个空行或另一个块级结构的开始处中断：

\`\`\`example table
| abc | def |
| --- | --- |
| bar | baz |
> bar
.
<table>
<thead>
<tr>
<th>abc</th>
<th>def</th>
</tr>
</thead>
<tbody>
<tr>
<td>bar</td>
<td>baz</td>
</tr>
</tbody>
</table>
<blockquote>
<p>bar</p>
</blockquote>
\`\`\`

\`\`\`example table
| abc | def |
| --- | --- |
| bar | baz |
bar

bar
.
<table>
<thead>
<tr>
<th>abc</th>
<th>def</th>
</tr>
</thead>
<tbody>
<tr>
<td>bar</td>
<td>baz</td>
</tr>
<tr>
<td>bar</td>
<td></td>
</tr>
</tbody>
</table>
<p>bar</p>
\`\`\`

标题行必须在单元格数量上与 [分隔符行] 匹配。否则，表格将不会被识别：

\`\`\`example table
| abc | def |
| --- |
| bar |
.
<p>| abc | def |
| --- |
| bar |</p>
\`\`\`

表格其余行的单元格数量可以变化。如果单元格数量少于标题行中的单元格数量，则插入空单元格。如果更多，则忽略多余的：

\`\`\`example table
| abc | def |
| --- | --- |
| bar |
| bar | baz | boo |
.
<table>
<thead>
<tr>
<th>abc</th>
<th>def</th>
</tr>
</thead>
<tbody>
<tr>
<td>bar</td>
<td></td>
</tr>
<tr>
<td>bar</td>
<td>baz</td>
</tr>
</tbody>
</table>
\`\`\`

如果主体中没有行，则 HTML 输出中不会生成 \`<tbody>\`：

\`\`\`example table
| abc | def |
| --- | --- |
.
<table>
<thead>
<tr>
<th>abc</th>
<th>def</th>
</tr>
</thead>
</table>
\`\`\`

</div>

# 容器块 (Container blocks)

[容器块](#container-blocks) 是具有其他块作为其内容的块。有两种基本类型的容器块：[块引用] 和 [列表项]。[列表] 是 [列表项] 的元容器。

我们递归地定义容器块的语法。定义的一般形式是：

> 如果 X 是块的序列，则以某种方式转换 X 的结果是类型为 Y 的容器，
> 这些块作为其内容。

因此，我们通过解释如何从它们的内容 _生成_ 块引用或列表项来说明什么算作块引用或列表项。这应该足以定义语法，尽管它没有给出 _解析_ 这些结构的方法。(在标题为 [解析策略](#appendix-a-parsing-strategy) 的部分中提供了方法。)

## 块引用 (Block quotes)

[块引用标记](@) 由 0-3 个初始缩进空格加上 (a) 字符 \`>\` 以及后面的空格，或 (b) 单个字符 \`>\` 后面不跟空格组成。

以下规则定义 [块引用]：

1.  **基本情况 (Basic case)。** 如果一串行 _Ls_ 构成块序列 _Bs_，那么在 _Ls_ 中每行开头添加 [块引用标记] 的结果是包含 _Bs_ 的 [块引用](#block-quotes)。

2.  **惰性 (Laziness)。** 如果一串行 _Ls_ 构成内容为 _Bs_ 的 [块引用](#block-quotes)，那么从一行或多行中删除初始 [块引用标记]（这些行中 [块引用标记] 后的下一个 [非空白字符] 是 [段落续行文本]）的结果是内容为 _Bs_ 的块引用。[段落续行文本](@) 是将被解析为段落内容一部分但不出现在段落开头的文本。

3.  **连续性 (Consecutiveness)。** 除非它们之间有 [空行]，否则文档不能包含连续的两个 [块引用]。

其他任何内容都不算作 [块引用](#block-quotes)。

这是一个简单示例：

\`\`\`example
> # Foo
> bar
> baz
.
<blockquote>
<h1>Foo</h1>
<p>bar
baz</p>
</blockquote>
\`\`\`

\`>\` 字符后面的空格可以省略：

\`\`\`example
># Foo
>bar
> baz
.
<blockquote>
<h1>Foo</h1>
<p>bar
baz</p>
</blockquote>
\`\`\`

\`>\` 字符可以缩进 1-3 个空格：

\`\`\`example
   > # Foo
   > bar
 > baz
.
<blockquote>
<h1>Foo</h1>
<p>bar
baz</p>
</blockquote>
\`\`\`

四个空格会产生代码块：

\`\`\`example
    > # Foo
    > bar
    > baz
.
<pre><code>&gt; # Foo
&gt; bar
&gt; baz
</code></pre>
\`\`\`

惰性子句允许我们在 [段落续行文本] 之前省略 \`>\`：

\`\`\`example
> # Foo
> bar
baz
.
<blockquote>
<h1>Foo</h1>
<p>bar
baz</p>
</blockquote>
\`\`\`

块引用可以包含一些惰性和一些非惰性续行：

\`\`\`example
> bar
baz
> foo
.
<blockquote>
<p>bar
baz
foo</p>
</blockquote>
\`\`\`

惰性只适用于如果前面加上 [块引用标记] 就会成为段落续行的行。例如，在第二行中不能省略 \`> \`：

\`\`\`markdown
> ## foo
\`\`\`

而不改变含义：

\`\`\`example
> foo
---
.
<blockquote>
<p>foo</p>
</blockquote>
<hr />
\`\`\`

同样，如果我们在第二行中省略 \`> \`：

\`\`\`markdown
> - foo
> - bar
\`\`\`

那么块引用在第一行之后结束：

\`\`\`example
> - foo
- bar
.
<blockquote>
<ul>
<li>foo</li>
</ul>
</blockquote>
<ul>
<li>bar</li>
</ul>
\`\`\`

出于同样的原因，我们不能在缩进或围栏代码块的后续行前面省略 \`> \`：

\`\`\`example
>     foo
    bar
.
<blockquote>
<pre><code>foo
</code></pre>
</blockquote>
<pre><code>bar
</code></pre>
\`\`\`

\`\`\`\`example
> \`\`\`
foo
\`\`\`
.
<blockquote>
<pre><code></code></pre>
</blockquote>
<p>foo</p>
<pre><code></code></pre>
\`\`\`\`

请注意，在下面的情况中，我们有一个 [惰性续行行]：

\`\`\`example
> foo
    - bar
.
<blockquote>
<p>foo
- bar</p>
</blockquote>
\`\`\`

要了解原因，请注意在以下情况中：

\`\`\`markdown
> foo - bar
\`\`\`

\`- bar\` 缩进太远而无法开始列表，并且不能是缩进代码块，因为缩进代码块不能中断段落，因此它是 [段落续行文本]。

块引用可以为空：

\`\`\`example
>
.
<blockquote>
</blockquote>
\`\`\`

\`\`\`example
>
>
>
.
<blockquote>
</blockquote>
\`\`\`

块引用可以有初始或最终空行：

\`\`\`example
>
> foo
>
.
<blockquote>
<p>foo</p>
</blockquote>
\`\`\`

空行总是分隔块引用：

\`\`\`example
> foo

> bar
.
<blockquote>
<p>foo</p>
</blockquote>
<blockquote>
<p>bar</p>
</blockquote>
\`\`\`

(大多数当前的 Markdown 实现，包括 John Gruber 的原始 \`Markdown.pl\`，会将此示例解析为包含两个段落的单个块引用。但似乎最好让作者决定是要两个块引用还是一个。)

连续性意味着如果我们将这些块引用放在一起，我们会得到一个单一的块引用：

\`\`\`example
> foo
> bar
.
<blockquote>
<p>foo
bar</p>
</blockquote>
\`\`\`

要获得包含两个段落的块引用，请使用：

\`\`\`example
> foo
>
> bar
.
<blockquote>
<p>foo</p>
<p>bar</p>
</blockquote>
\`\`\`

块引用可以中断段落：

\`\`\`example
foo
> bar
.
<p>foo</p>
<blockquote>
<p>bar</p>
</blockquote>
\`\`\`

通常，块引用前后不需要空行：

\`\`\`example
> aaa
***
> bbb
.
<blockquote>
<p>aaa</p>
</blockquote>
<hr />
<blockquote>
<p>bbb</p>
</blockquote>
\`\`\`

但是，由于惰性，块引用和后面的段落之间需要一个空行：

\`\`\`example
> bar
baz
.
<blockquote>
<p>bar
baz</p>
</blockquote>
\`\`\`

\`\`\`example
> bar

baz
.
<blockquote>
<p>bar</p>
</blockquote>
<p>baz</p>
\`\`\`

\`\`\`example
> bar
>
baz
.
<blockquote>
<p>bar</p>
</blockquote>
<p>baz</p>
\`\`\`

惰性规则的结果是，嵌套块引用的续行行上可以省略任意数量的初始 \`>\`：

\`\`\`example
> > > foo
bar
.
<blockquote>
<blockquote>
<blockquote>
<p>foo
bar</p>
</blockquote>
</blockquote>
</blockquote>
\`\`\`

\`\`\`example
>>> foo
> bar
>>baz
.
<blockquote>
<blockquote>
<blockquote>
<p>foo
bar
baz</p>
</blockquote>
</blockquote>
</blockquote>
\`\`\`

在块引用中包含缩进代码块时，请记住 [块引用标记] 包括 \`>\` 和后面的空格。因此 \`>\` 后面需要 _五个空格_：

\`\`\`example
>     代码

>    不是代码
.
<blockquote>
<pre><code>代码
</code></pre>
</blockquote>
<blockquote>
<p>不是代码</p>
</blockquote>
\`\`\`

## 列表项 (List items)

[列表标记](@) 是 [项目符号列表标记] 或 [有序列表标记]。

[项目符号列表标记](@) 是 \`-\`、\`+\` 或 \`*\` 字符。

[有序列表标记](@) 是 1-9 个阿拉伯数字 (\`0-9\`) 的序列，后跟 \`.\` 字符或 \`)\` 字符。(长度限制的原因是，在某些浏览器中，10 位数字会开始出现整数溢出。)

以下规则定义 [列表项]：

1.  **基本情况 (Basic case)。** 如果行序列 _Ls_ 构成以 [非空白字符] 开头的块序列 _Bs_，并且 _M_ 是宽度为 _W_ 的列表标记，后跟 1 ≤ _N_ ≤ 4 个空格，那么在 _Ls_ 第一行前面添加 _M_ 和后续空格，并将 _Ls_ 后续行缩进 _W + N_ 个空格的结果是内容为 _Bs_ 的列表项。列表项的类型（项目符号或有序）由其列表标记的类型决定。如果列表项是有序的，则还会根据有序列表标记为其分配起始编号。

    例外情况 (Exceptions)：
    1. 当 [列表] 中的第一个列表项中断段落时——也就是说，当它从本应算作 [段落续行文本] 的行开始时——那么 (a) 行 _Ls_ 不得以空行开头，并且 (b) 如果列表项是有序的，起始编号必须为 1。
    2. 如果任何行是 [分隔线][thematic breaks]，则该行不是列表项。

例如，设 _Ls_ 为以下行：

\`\`\`example
一个段落
有两行。

    缩进代码

> 一个块引用。
.
<p>一个段落
有两行。</p>
<pre><code>缩进代码
</code></pre>
<blockquote>
<p>一个块引用。</p>
</blockquote>
\`\`\`

设 _M_ 为标记 \`1.\`，_N_ = 2。那么规则 #1 说以下是一个起始编号为 1 的有序列表项，其内容与 _Ls_ 相同：

\`\`\`example
1.  一个段落
    有两行。

        缩进代码

    > 一个块引用。
.
<ol>
<li>
<p>一个段落
有两行。</p>
<pre><code>缩进代码
</code></pre>
<blockquote>
<p>一个块引用。</p>
</blockquote>
</li>
</ol>
\`\`\`

最重要的是要注意，列表标记后面的文本位置决定了列表项中后续块需要多少缩进。如果列表标记占用两个空格，并且列表标记和下一个 [非空白字符] 之间有三个空格，则块必须缩进五个空格才能属于列表项。

以下是一些示例，显示内容必须缩进多远才能放在列表项下：

\`\`\`example
- one

 two
.
<ul>
<li>one</li>
</ul>
<p>two</p>
\`\`\`

\`\`\`example
- one

  two
.
<ul>
<li>
<p>one</p>
<p>two</p>
</li>
</ul>
\`\`\`

\`\`\`example
 -    one

     two
.
<ul>
<li>one</li>
</ul>
<pre><code> two
</code></pre>
\`\`\`

\`\`\`example
 -    one

      two
.
<ul>
<li>
<p>one</p>
<p>two</p>
</li>
</ul>
\`\`\`

很容易从列的角度来考虑这个问题：续行块必须至少缩进到列表标记后第一个 [非空白字符] 的列。但是，这并不完全正确。列表标记后面的空格决定了需要多少相对缩进。这种缩进到达哪一列将取决于列表项如何嵌入到其他结构中，如此示例所示：

\`\`\`example
   > > 1.  one
>>
>>     two
.
<blockquote>
<blockquote>
<ol>
<li>
<p>one</p>
<p>two</p>
</li>
</ol>
</blockquote>
</blockquote>
\`\`\`

这里 \`two\` 出现在与列表标记 \`1.\` 相同的列中，但实际上包含在列表项中，因为在最后一个包含的块引用标记之后有足够的缩进。

相反的情况也是可能的。在下面的示例中，单词 \`two\` 出现在列表项初始文本 \`one\` 的右侧很远，但它不被视为列表项的一部分，因为它没有足够地缩进超过块引用标记：

\`\`\`example
>>- one
>>
  >  > two
.
<blockquote>
<blockquote>
<ul>
<li>one</li>
</ul>
<p>two</p>
</blockquote>
</blockquote>
\`\`\`

请注意，列表标记和任何后续内容之间至少需要一个空格，因此这些不是列表项：

\`\`\`example
-one

2.two
.
<p>-one</p>
<p>2.two</p>
\`\`\`

列表项可以包含由多个空行分隔的块。

\`\`\`example
- foo


  bar
.
<ul>
<li>
<p>foo</p>
<p>bar</p>
</li>
</ul>
\`\`\`

列表项可以包含任何类型的块：

\`\`\`\`example
1.  foo

    \`\`\`
    bar
    \`\`\`

    baz

    > bam
.
<ol>
<li>
<p>foo</p>
<pre><code>bar
</code></pre>
<p>baz</p>
<blockquote>
<p>bam</p>
</blockquote>
</li>
</ol>
\`\`\`\`

包含缩进代码块的列表项将按原样保留代码块内的空行。

\`\`\`example
- Foo

      bar


      baz
.
<ul>
<li>
<p>Foo</p>
<pre><code>bar


baz
</code></pre>
</li>
</ul>
\`\`\`

请注意，有序列表起始编号必须是九位数字或更少：

\`\`\`example
123456789. 可以
.
<ol start="123456789">
<li>可以</li>
</ol>
\`\`\`

\`\`\`example
1234567890. 不可以
.
<p>1234567890. 不可以</p>
\`\`\`

起始编号可以以 0 开头：

\`\`\`example
0. 可以
.
<ol start="0">
<li>可以</li>
</ol>
\`\`\`

\`\`\`example
003. 可以
.
<ol start="3">
<li>可以</li>
</ol>
\`\`\`

起始编号不能为负数：

\`\`\`example
-1. 不可以
.
<p>-1. 不可以</p>
\`\`\`

2.  **以缩进代码开始的项 (Item starting with indented code)。** 如果行序列 _Ls_ 构成以缩进代码块开头的块序列 _Bs_，并且 _M_ 是宽度为 _W_ 的列表标记，后跟一个空格，那么在 _Ls_ 第一行前面添加 _M_ 和后续空格，并将 _Ls_ 后续行缩进 _W + 1_ 个空格的结果是内容为 _Bs_ 的列表项。如果一行是空的，则不需要缩进。列表项的类型（项目符号或有序）由其列表标记的类型决定。如果列表项是有序的，则还会根据有序列表标记为其分配起始编号。

缩进代码块必须缩进超过文本将包含在列表项中的区域边缘四个空格。在下面的情况中是 6 个空格：

\`\`\`example
- foo

      bar
.
<ul>
<li>
<p>foo</p>
<pre><code>bar
</code></pre>
</li>
</ul>
\`\`\`

在这种情况下是 11 个空格：

\`\`\`example
  10.  foo

           bar
.
<ol start="10">
<li>
<p>foo</p>
<pre><code>bar
</code></pre>
</li>
</ol>
\`\`\`

如果列表项中的 _第一个_ 块是缩进代码块，那么根据规则 #2，内容必须在列表标记后缩进 _一个_ 空格：

\`\`\`example
    缩进代码

段落

    更多代码
.
<pre><code>缩进代码
</code></pre>
<p>段落</p>
<pre><code>更多代码
</code></pre>
\`\`\`

\`\`\`example
1.     缩进代码

   段落

       更多代码
.
<ol>
<li>
<pre><code>缩进代码
</code></pre>
<p>段落</p>
<pre><code>更多代码
</code></pre>
</li>
</ol>
\`\`\`

请注意，额外的空格缩进被解释为代码块内的空格：

\`\`\`example
1.      缩进代码

   段落

       更多代码
.
<ol>
<li>
<pre><code> 缩进代码
</code></pre>
<p>段落</p>
<pre><code>更多代码
</code></pre>
</li>
</ol>
\`\`\`

请注意，规则 #1 和 #2 仅适用于两种情况：(a) 要包含在列表项中的行以 [非空白字符] 开头的情况，以及 (b) 它们以缩进代码块开头的情况。在像下面这样的情况中，第一个块以三个空格缩进开始，规则不允许我们通过缩进整个内容并在前面加上列表标记来形成列表项：

\`\`\`example
   foo

bar
.
<p>foo</p>
<p>bar</p>
\`\`\`

\`\`\`example
-    foo

  bar
.
<ul>
<li>foo</li>
</ul>
<p>bar</p>
\`\`\`

这不是一个重大限制，因为当块以 1-3 个空格缩进开始时，总是可以在不改变解释的情况下删除缩进，从而允许应用规则 #1。因此，在上述情况下：

\`\`\`example
-  foo

   bar
.
<ul>
<li>
<p>foo</p>
<p>bar</p>
</li>
</ul>
\`\`\`

3.  **以空行开始的项 (Item starting with a blank line)。** 如果以单个 [空行] 开始的行序列 _Ls_ 构成（可能为空的）块序列 _Bs_，彼此之间的分隔不超过一个空行，并且 _M_ 是宽度为 _W_ 的列表标记，那么在 _Ls_ 第一行前面添加 _M_，并将 _Ls_ 后续行缩进 _W + 1_ 个空格的结果是内容为 _Bs_ 的列表项。如果一行是空的，则不需要缩进。列表项的类型（项目符号或有序）由其列表标记的类型决定。如果列表项是有序的，则还会根据有序列表标记为其分配起始编号。

以下是一些以空行开始但不为空的列表项：

\`\`\`\`example
-
  foo
-
  \`\`\`
  bar
  \`\`\`
-
      baz
.
<ul>
<li>foo</li>
<li>
<pre><code>bar
</code></pre>
</li>
<li>
<pre><code>baz
</code></pre>
</li>
</ul>
\`\`\`\`

当列表项以空行开始时，列表标记后面的空格数量不会改变所需的缩进：

\`\`\`example
-
  foo
.
<ul>
<li>foo</li>
</ul>
\`\`\`

列表项最多可以以一个空行开始。在下面的示例中，\`foo\` 不是列表项的一部分：

\`\`\`example
-

  foo
.
<ul>
<li></li>
</ul>
<p>foo</p>
\`\`\`

这是一个空的项目符号列表项：

\`\`\`example
- foo
-
- bar
.
<ul>
<li>foo</li>
<li></li>
<li>bar</li>
</ul>
\`\`\`

[列表标记] 后面是否有空格无关紧要：

\`\`\`example
- foo
-
- bar
.
<ul>
<li>foo</li>
<li></li>
<li>bar</li>
</ul>
\`\`\`

这是一个空的有序列表项：

\`\`\`example
1. foo
2.
3. bar
.
<ol>
<li>foo</li>
<li></li>
<li>bar</li>
</ol>
\`\`\`

列表可以以空列表项开始或结束：

\`\`\`example
*
.
<ul>
<li></li>
</ul>
\`\`\`

但是，空列表项不能中断段落：

\`\`\`example
foo
*

foo
1.
.
<p>foo
*</p>
<p>foo
1.</p>
\`\`\`

4.  **缩进 (Indentation)。** 如果行序列 _Ls_ 根据规则 #1、#2 或 #3 构成列表项，那么将 _Ls_ 的每一行缩进 1-3 个空格（每行相同）的结果也构成具有相同内容和属性的列表项。如果一行是空的，则不需要缩进。

缩进一个空格：

\`\`\`example
 1.  一个段落
     有两行。

         缩进代码

     > 一个块引用。
.
<ol>
<li>
<p>一个段落
有两行。</p>
<pre><code>缩进代码
</code></pre>
<blockquote>
<p>一个块引用。</p>
</blockquote>
</li>
</ol>
\`\`\`

缩进两个空格：

\`\`\`example
  1.  一个段落
      有两行。

          缩进代码

      > 一个块引用。
.
<ol>
<li>
<p>一个段落
有两行。</p>
<pre><code>缩进代码
</code></pre>
<blockquote>
<p>一个块引用。</p>
</blockquote>
</li>
</ol>
\`\`\`

缩进三个空格：

\`\`\`example
   1.  一个段落
       有两行。

           缩进代码

       > 一个块引用。
.
<ol>
<li>
<p>一个段落
有两行。</p>
<pre><code>缩进代码
</code></pre>
<blockquote>
<p>一个块引用。</p>
</blockquote>
</li>
</ol>
\`\`\`

四个空格缩进产生代码块：

\`\`\`example
    1.  一个段落
        有两行。

            缩进代码

        > 一个块引用。
.
<pre><code>1.  一个段落
    有两行。

        缩进代码

    &gt; 一个块引用。
</code></pre>
\`\`\`

5.  **惰性 (Laziness)。** 如果行串 _Ls_ 构成内容为 _Bs_ 的 [列表项](#list-items)，那么从一行或多行中删除部分或全部缩进（这些行中缩进后的下一个 [非空白字符] 是 [段落续行文本]）的结果是具有相同内容和属性的列表项。未缩进的行称为 [惰性续行行](@)。

这是一个带有 [惰性续行行] 的示例：

\`\`\`example
  1.  一个段落
有两行。

          缩进代码

      > 一个块引用。
.
<ol>
<li>
<p>一个段落
有两行。</p>
<pre><code>缩进代码
</code></pre>
<blockquote>
<p>一个块引用。</p>
</blockquote>
</li>
</ol>
\`\`\`

缩进可以部分删除：

\`\`\`example
  1.  一个段落
    有两行。
.
<ol>
<li>一个段落
有两行。</li>
</ol>
\`\`\`

这些示例展示了惰性如何在嵌套结构中工作：

\`\`\`example
> 1. > 块引用
在此继续。
.
<blockquote>
<ol>
<li>
<blockquote>
<p>块引用
在此继续。</p>
</blockquote>
</li>
</ol>
</blockquote>
\`\`\`

\`\`\`example
> 1. > 块引用
> 在此继续。
.
<blockquote>
<ol>
<li>
<blockquote>
<p>块引用
在此继续。</p>
</blockquote>
</li>
</ol>
</blockquote>
\`\`\`

6.  **仅此而已 (That's all)。** 未被规则 #1--5 计为列表项的任何内容都不算作 [列表项](#list-items)。

子列表的规则遵循 [上述][List items] 一般规则。子列表必须缩进与段落为了包含在列表项中所需的相同数量的空格。

因此，在这种情况下我们需要两个空格缩进：

\`\`\`example
- foo
  - bar
    - baz
      - boo
.
<ul>
<li>foo
<ul>
<li>bar
<ul>
<li>baz
<ul>
<li>boo</li>
</ul>
</li>
</ul>
</li>
</ul>
</li>
</ul>
\`\`\`

一个不够：

\`\`\`example
- foo
 - bar
  - baz
   - boo
.
<ul>
<li>foo</li>
<li>bar</li>
<li>baz</li>
<li>boo</li>
</ul>
\`\`\`

这里我们需要四个，因为列表标记更宽：

\`\`\`example
10) foo
    - bar
.
<ol start="10">
<li>foo
<ul>
<li>bar</li>
</ul>
</li>
</ol>
\`\`\`

三个不够：

\`\`\`example
10) foo
   - bar
.
<ol start="10">
<li>foo</li>
</ol>
<ul>
<li>bar</li>
</ul>
\`\`\`

列表可以是列表项中的第一个块：

\`\`\`example
- - foo
.
<ul>
<li>
<ul>
<li>foo</li>
</ul>
</li>
</ul>
\`\`\`

\`\`\`example
1. - 2. foo
.
<ol>
<li>
<ul>
<li>
<ol start="2">
<li>foo</li>
</ol>
</li>
</ul>
</li>
</ol>
\`\`\`

列表项可以包含标题：

\`\`\`example
- # Foo
- Bar
  ---
  baz
.
<ul>
<li>
<h1>Foo</h1>
</li>
<li>
<h2>Bar</h2>
baz</li>
</ul>
\`\`\`

### 动机 (Motivation)

John Gruber 的 Markdown 规范对列表项说了以下内容：

1. "列表标记通常从左边距开始，但可以缩进最多三个空格。列表标记后面必须跟一个或多个空格或制表符。"

2. "为了让列表看起来美观，你可以用悬挂缩进来包装项目……但如果你不想这样做，你也不必这样做。"

3. "列表项可以由多个段落组成。列表项中的每个后续段落必须缩进 4 个空格或一个制表符。"

4. "如果你缩进后续段落的每一行看起来会很好，但同样，Markdown 允许你偷懒。"

5. "要在列表项中放置块引用，块引用的 \`>\` 定界符需要缩进。"

6. "要在列表项中放置代码块，代码块需要缩进两次——8 个空格或两个制表符。"

这些规则指定列表项下的段落必须缩进四个空格 (大概是从左边距开始，而不是从列表标记的开始，但这没有说明)，并且列表项下的代码必须缩进八个空格而不是通常的四个。它们还说块引用必须缩进，但没有说多少；然而，给出的示例有四个空格缩进。虽然没有说明其他类型的块级内容，但可以合理推断列表项下的 _所有_ 块元素（包括其他列表）都必须缩进四个空格。这个原则被称为 _四空格规则_。

四空格规则清晰且有原则，如果参考实现 \`Markdown.pl\` 遵循了它，它可能会成为标准。然而，\`Markdown.pl\` 允许段落和子列表以只有两个空格的缩进开始，至少在外层是这样。更糟糕的是，它的行为不一致：外层列表的子列表需要两个空格缩进，但这个子列表的子列表需要三个空格。因此，不同的 Markdown 实现为确定列表项下的内容制定了非常不同的规则就不足为奇了。(例如，Pandoc 和 python-Markdown 坚持 Gruber 的语法描述和四空格规则，而 discount、redcarpet、marked、PHP Markdown 和其他实现更紧密地遵循 \`Markdown.pl\` 的行为。)

不幸的是，鉴于各实现之间的差异，没有办法给出一个能保证不破坏任何现有文档的列表项规范。然而，这里给出的规范应该能正确处理使用四空格规则或更宽容的 \`Markdown.pl\` 行为格式化的列表，前提是它们以对人类来说自然的方式布局。

这里的策略是让列表标记的宽度和缩进决定块属于列表项所需的缩进，而不是使用固定和任意的数字。作者可以将列表项的主体视为一个单元，该单元向右缩进足够的空间以适应列表标记 (以及列表标记上的任何缩进)。(惰性规则 #5 允许续行在需要时不缩进。)

我们声称，这条规则优于任何要求从边距开始的固定缩进级别的规则。四空格规则清晰但不自然。以下情况非常不直观：

\`\`\`markdown
- foo

  bar
  - baz
\`\`\`

应该被解析为两个列表和一个中间段落，

\`\`\`html
<ul>
  <li>foo</li>
</ul>
<p>bar</p>
<ul>
  <li>baz</li>
</ul>
\`\`\`

正如四空格规则所要求的那样，而不是单个列表，

\`\`\`html
<ul>
  <li>
    <p>foo</p>
    <p>bar</p>
    <ul>
      <li>baz</li>
    </ul>
  </li>
</ul>
\`\`\`

选择四个空格是任意的。它可以学习，但不太可能被猜到，并且经常让初学者感到困惑。

采用两个空格的规则会有帮助吗？问题在于这样的规则，加上允许初始列表标记缩进 1--3 个空格的规则，允许缩进 _少于_ 原始列表标记的文本被包含在列表项中。例如，\`Markdown.pl\` 解析

\`\`\`markdown
- 一

二
\`\`\`

为单个列表项，其中 \`二\` 是续行段落：

\`\`\`html
<ul>
  <li>
    <p>一</p>
    <p>二</p>
  </li>
</ul>
\`\`\`

类似地

\`\`\`markdown
> - 一
>
> 二
\`\`\`

解析为

\`\`\`html
<blockquote>
  <ul>
    <li>
      <p>一</p>
      <p>二</p>
    </li>
  </ul>
</blockquote>
\`\`\`

这非常不直观。

我们可以不要求从边距开始的固定缩进，而是要求从列表标记开始的固定缩进（比如两个空格，甚至一个空格）（列表标记本身可能已经缩进）。这个提议将消除讨论的最后一个异常。与上面给出的规范不同，它会将以下内容视为带有子段落的列表项，即使段落 \`bar\` 的缩进不如第一个段落 \`foo\` 那么远：

\`\`\`markdown
10. foo

bar
\`\`\`

可以说这段文本确实读起来像一个带有 \`bar\` 作为子段落的列表项，这可能有利于这个提议。但是，根据这个提议，缩进代码必须在列表标记后缩进六个空格。这将破坏很多现有的 Markdown，其模式为：

\`\`\`markdown
1.  foo

        缩进代码
\`\`\`

其中代码缩进了八个空格。相比之下，上面的规范将按预期解析此文本，因为代码块的缩进是从 \`foo\` 的开头测量的。

需要特殊处理的一种情况是 _以_ 缩进代码开始的列表项。在这种情况下需要多少缩进，因为我们没有"第一个段落"来衡量？规则 #2 简单规定，在这种情况下，我们需要从列表标记缩进一个空格 (然后是缩进代码的正常四个空格)。这将在列表标记加上其初始缩进占用四个空格 (常见情况) 的情况下匹配四空格规则，但在其他情况下会有所不同。

<div class="extension">

## 任务列表项（扩展）(Task list items (extension))

GFM 启用了 \`tasklist\` 扩展，对 [列表项] 执行额外的处理步骤。

[任务列表项](@) 是一个 [列表项][list items]，其中的第一个块是一个段落，该段落以 [任务列表项标记] 开头，并在任何其他内容之前至少有一个空白字符。

[任务列表项标记](@) 由可选数量的空格、左方括号 (\`[\`)、空白字符或大小写字母 \`x\`，然后是右方括号 (\`]\`) 组成。

渲染时，[任务列表项标记] 被替换为语义复选框元素；在 HTML 输出中，这将是一个 \`<input type="checkbox">\` 元素。

如果方括号之间的字符是空白字符，则复选框未选中。否则，复选框被选中。

本规范未定义如何与复选框元素交互：在实践中，实现者可以自由地将复选框呈现为禁用或不可变元素，或者他们可以在最终呈现的文档中动态处理动态交互 (即选中、取消选中)。

\`\`\`example disabled
- [ ] foo
- [x] bar
.
<ul>
<li><input disabled="" type="checkbox"> foo</li>
<li><input checked="" disabled="" type="checkbox"> bar</li>
</ul>
\`\`\`

任务列表可以任意嵌套：

\`\`\`example disabled
- [x] foo
  - [ ] bar
  - [x] baz
- [ ] bim
.
<ul>
<li><input checked="" disabled="" type="checkbox"> foo
<ul>
<li><input disabled="" type="checkbox"> bar</li>
<li><input checked="" disabled="" type="checkbox"> baz</li>
</ul>
</li>
<li><input disabled="" type="checkbox"> bim</li>
</ul>
\`\`\`

</div>

## 列表 (Lists)

[列表](@) 是一个或多个 [相同类型] 的列表项的序列。列表项可以由任意数量的空行分隔。

如果两个列表项以相同类型的 [列表标记] 开头，则它们是 [相同类型](@) 的。如果 (a) 它们是使用相同字符 (\`-\`、\`+\` 或 \`*\`) 的项目符号列表标记，或 (b) 它们是具有相同定界符 (\`.\` 或 \`)\`) 的有序列表编号，则两个列表标记属于同一类型。

如果列表的组成列表项以 [有序列表标记] 开头，则列表是 [有序列表](@)；如果其组成列表项以 [项目符号列表标记] 开头，则列表是 [项目符号列表](@)。

[起始编号](@) 由 [有序列表] 的初始列表项的列表编号确定。后续列表项的编号被忽略。

如果列表的任何组成列表项由空行分隔，或者如果其任何组成列表项直接包含两个块级元素且它们之间有空行，则列表是 [宽松](@) 的。否则列表是 [紧凑](@) 的。(HTML 输出的区别在于宽松列表中的段落用 \`<p>\` 标签包裹，而紧凑列表中的段落则不是。)

更改项目符号或有序列表定界符会开始一个新列表：

\`\`\`example
- foo
- bar
+ baz
.
<ul>
<li>foo</li>
<li>bar</li>
</ul>
<ul>
<li>baz</li>
</ul>
\`\`\`

\`\`\`example
1. foo
2. bar
3) baz
.
<ol>
<li>foo</li>
<li>bar</li>
</ol>
<ol start="3">
<li>baz</li>
</ol>
\`\`\`

在 CommonMark 中，列表可以中断段落。也就是说，不需要空行来将段落与后面的列表分隔开：

\`\`\`example
Foo
- bar
- baz
.
<p>Foo</p>
<ul>
<li>bar</li>
<li>baz</li>
</ul>
\`\`\`

\`Markdown.pl\` 不允许这样做，因为担心通过硬换行行中的数字触发列表：

\`\`\`markdown
我家窗户的数量是 14。门的数量是 6。
\`\`\`

奇怪的是，\`Markdown.pl\` _确实_ 允许块引用中断段落，尽管可能适用相同的考虑。

在 CommonMark 中，我们确实允许列表中断段落，原因有两个。首先，人们在没有空行的情况下开始列表是很自然且不罕见的：

\`\`\`markdown
我需要购买

- 新鞋
- 一件外套
- 一张机票
\`\`\`

其次，我们被以下原则所吸引：

> [统一性原则](@)：
> 如果一段文本具有某种含义，当它被放入容器块 (例如列表项或块引用) 时，它将继续具有相同的含义。

(实际上，[列表项] 和 [块引用] 的规范就预设了这一原则。) 这一原则意味着，如果

\`\`\`markdown
- 我需要购买
  - 新鞋
  - 一件外套
  - 一张机票
\`\`\`

是一个包含段落后跟嵌套子列表的列表项，正如所有 Markdown 实现所认为的那样（尽管段落可能在没有 \`<p>\` 标签的情况下渲染，因为列表是"紧凑的"），那么

\`\`\`markdown
我需要购买

- 新鞋
- 一件外套
- 一张机票
\`\`\`

本身应该是一个段落后跟一个嵌套子列表。

由于允许列表中断列表项内的段落是公认的 Markdown 实践，[统一性原则] 要求我们也允许在列表项之外这样做。([reStructuredText](http://docutils.sourceforge.net/rst.html) 采用不同的方法，即使在其他列表项内也要求列表前有空行。)

为了解决在带有硬换行数字的段落中出现不需要的列表的问题，我们只允许以 \`1\` 开头的列表中断段落。因此：

\`\`\`example
我家窗户的数量是
14.  门的数量是 6。
.
<p>我家窗户的数量是
14.  门的数量是 6。</p>
\`\`\`

在某些情况下，我们可能仍然会得到意外的结果，例如：

\`\`\`example
我家窗户的数量是
1.  门的数量是 6。
.
<p>我家窗户的数量是</p>
<ol>
<li>门的数量是 6。</li>
</ol>
\`\`\`

但这条规则应该可以防止大多数虚假的列表捕获。

项目之间可以有任意数量的空行：

\`\`\`example
- foo

- bar


- baz
.
<ul>
<li>
<p>foo</p>
</li>
<li>
<p>bar</p>
</li>
<li>
<p>baz</p>
</li>
</ul>
\`\`\`

\`\`\`example
- foo
  - bar
    - baz


      bim
.
<ul>
<li>foo
<ul>
<li>bar
<ul>
<li>
<p>baz</p>
<p>bim</p>
</li>
</ul>
</li>
</ul>
</li>
</ul>
\`\`\`

要分隔相同类型的连续列表，或将列表与缩进代码块分隔开 (否则会被解析为最终列表项的子段落)，您可以插入一个空白 HTML 注释：

\`\`\`example
- foo
- bar

<!-- -->

- baz
- bim
.
<ul>
<li>foo</li>
<li>bar</li>
</ul>
<!-- -->
<ul>
<li>baz</li>
<li>bim</li>
</ul>
\`\`\`

\`\`\`example
-   foo

    不是代码

-   foo

<!-- -->

    代码
.
<ul>
<li>
<p>foo</p>
<p>不是代码</p>
</li>
<li>
<p>foo</p>
</li>
</ul>
<!-- -->
<pre><code>代码
</code></pre>
\`\`\`

列表项不需要缩进到同一级别。以下列表项将被视为同一列表级别的项目，因为没有一个缩进足够属于前一个列表项：

\`\`\`example
- a
 - b
  - c
   - d
  - e
 - f
- g
.
<ul>
<li>a</li>
<li>b</li>
<li>c</li>
<li>d</li>
<li>e</li>
<li>f</li>
<li>g</li>
</ul>
\`\`\`

\`\`\`example
1. a

  2. b

   3. c
.
<ol>
<li>
<p>a</p>
</li>
<li>
<p>b</p>
</li>
<li>
<p>c</p>
</li>
</ol>
\`\`\`

但是，请注意，列表项的缩进不能超过三个空格。这里 \`- e\` 被视为段落续行行，因为它缩进超过三个空格：

\`\`\`example
- a
 - b
  - c
   - d
    - e
.
<ul>
<li>a</li>
<li>b</li>
<li>c</li>
<li>d
- e</li>
</ul>
\`\`\`

在这里，\`3. c\` 被视为缩进代码块，因为它缩进了四个空格并且前面有一个空行。

\`\`\`example
1. a

  2. b

    3. c
.
<ol>
<li>
<p>a</p>
</li>
<li>
<p>b</p>
</li>
</ol>
<pre><code>3. c
</code></pre>
\`\`\`

这是一个宽松列表，因为两个列表项之间有一个空行：

\`\`\`example
- a
- b

- c
.
<ul>
<li>
<p>a</p>
</li>
<li>
<p>b</p>
</li>
<li>
<p>c</p>
</li>
</ul>
\`\`\`

这也是，第二项为空：

\`\`\`example
* a
*

* c
.
<ul>
<li>
<p>a</p>
</li>
<li></li>
<li>
<p>c</p>
</li>
</ul>
\`\`\`

这些是宽松列表，尽管项目之间没有空格，因为其中一个项目直接包含两个块级元素，它们之间有一个空行：

\`\`\`example
- a
- b

  c
- d
.
<ul>
<li>
<p>a</p>
</li>
<li>
<p>b</p>
<p>c</p>
</li>
<li>
<p>d</p>
</li>
</ul>
\`\`\`

\`\`\`example
- a
- b

  [ref]: /url
- d
.
<ul>
<li>
<p>a</p>
</li>
<li>
<p>b</p>
</li>
<li>
<p>d</p>
</li>
</ul>
\`\`\`

这是一个紧凑列表，因为空行在代码块内：

\`\`\`\`example
- a
- \`\`\`
  b


  \`\`\`
- c
.
<ul>
<li>a</li>
<li>
<pre><code>b


</code></pre>
</li>
<li>c</li>
</ul>
\`\`\`\`

这是一个紧凑列表，因为空行在子列表的两个段落之间。因此子列表是宽松的，而外层列表是紧凑的：

\`\`\`example
- a
  - b

    c
- d
.
<ul>
<li>a
<ul>
<li>
<p>b</p>
<p>c</p>
</li>
</ul>
</li>
<li>d</li>
</ul>
\`\`\`

这是一个紧凑列表，因为空行在块引用内：

\`\`\`example
* a
  > b
  >
* c
.
<ul>
<li>a
<blockquote>
<p>b</p>
</blockquote>
</li>
<li>c</li>
</ul>
\`\`\`

这个列表是紧凑的，因为连续的块元素没有被空行分隔：

\`\`\`\`example
- a
  > b
  \`\`\`
  c
  \`\`\`
- d
.
<ul>
<li>a
<blockquote>
<p>b</p>
</blockquote>
<pre><code>c
</code></pre>
</li>
<li>d</li>
</ul>
\`\`\`\`

单段落列表是紧凑的：

\`\`\`example
- a
.
<ul>
<li>a</li>
</ul>
\`\`\`

\`\`\`example
- a
  - b
.
<ul>
<li>a
<ul>
<li>b</li>
</ul>
</li>
</ul>
\`\`\`

这个列表是宽松的，因为列表项中的两个块元素之间有空行：

\`\`\`\`example
1. \`\`\`
   foo
   \`\`\`

   bar
.
<ol>
<li>
<pre><code>foo
</code></pre>
<p>bar</p>
</li>
</ol>
\`\`\`\`

这里外层列表是宽松的，内层列表是紧凑的：

\`\`\`example
* foo
  * bar

  baz
.
<ul>
<li>
<p>foo</p>
<ul>
<li>bar</li>
</ul>
<p>baz</p>
</li>
</ul>
\`\`\`

\`\`\`example
- a
  - b
  - c

- d
  - e
  - f
.
<ul>
<li>
<p>a</p>
<ul>
<li>b</li>
<li>c</li>
</ul>
</li>
<li>
<p>d</p>
<ul>
<li>e</li>
<li>f</li>
</ul>
</li>
</ul>
\`\`\`

# 内联 (Inlines)

内联从字符流的开始到结束按顺序解析 (在从左到右的语言中从左到右)。因此，例如，在：

\`\`\`example
\`嗨\`咯\`
.
<p><code>嗨</code>咯\`</p>
\`\`\`

\`嗨\` 被解析为代码，末尾的反引号作为字面反引号保留。

## 反斜杠转义 (Backslash escapes)

任何 ASCII 标点字符都可以用反斜杠转义：

\`\`\`example
\\!\\"\\#\\$\\%\\&\\'\\(\\)\\*\\+\\,\\-\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\\\\\]\\^\\_\\\`\\{\\|\\}\\~
.
<p>!&quot;#$%&amp;'()*+,-./:;&lt;=&gt;?@[\\]^_\`{|}~</p>
\`\`\`

其他字符前的反斜杠被视为字面反斜杠：

\`\`\`example
\\→\\A\\a\\ \\3\\φ\\«
.
<p>\\→\\A\\a\\ \\3\\φ\\«</p>
\`\`\`

转义字符被视为常规字符，不具有其通常的 Markdown 含义：

\`\`\`example
\\*不是强调*
\\<br/> 不是标签
\\[不是链接](/foo)
\\\`不是代码\`
1\\. 不是列表
\\* 不是列表
\\# 不是标题
\\[foo]: /url "不是引用"
\\&ouml; 不是字符实体
.
<p>*不是强调*
&lt;br/&gt; 不是标签
[不是链接](/foo)
\`不是代码\`
1. 不是列表
* 不是列表
# 不是标题
[foo]: /url &quot;不是引用&quot;
&amp;ouml; 不是字符实体</p>
\`\`\`

如果反斜杠本身被转义，则后面的字符不会被转义：

\`\`\`example
\\\\*强调*
.
<p>\\<em>强调</em></p>
\`\`\`

行尾的反斜杠是 [硬换行]：

\`\`\`example
foo\\
bar
.
<p>foo<br />
bar</p>
\`\`\`

反斜杠转义在代码块、代码跨度、自动链接或原始 HTML 中不起作用：

\`\`\`example
\`\` \\[\\\` \`\`
.
<p><code>\\[\\\`</code></p>
\`\`\`

\`\`\`example
    \\[\\]
.
<pre><code>\\[\\]
</code></pre>
\`\`\`

\`\`\`example
~~~
\\[\\]
~~~
.
<pre><code>\\[\\]
</code></pre>
\`\`\`

\`\`\`example
<http://example.com?find=\\*>
.
<p><a href="http://example.com?find=%5C*">http://example.com?find=\\*</a></p>
\`\`\`

\`\`\`example
<a href="/bar\\/)">
.
<a href="/bar\\/)">
\`\`\`

但它们在所有其他上下文中都有效，包括 URL 和链接标题、链接引用以及 [围栏代码块] 中的 [info 字符串]：

\`\`\`example
[foo](/bar\\* "ti\\*tle")
.
<p><a href="/bar*" title="ti*tle">foo</a></p>
\`\`\`

\`\`\`example
[foo]

[foo]: /bar\\* "ti\\*tle"
.
<p><a href="/bar*" title="ti*tle">foo</a></p>
\`\`\`

\`\`\`\`example
\`\`\` foo\\+bar
foo
\`\`\`
.
<pre><code class="language-foo+bar">foo
</code></pre>
\`\`\`\`

## 实体和数字字符引用 (Entity and numeric character references)

有效的 HTML 实体引用和数字字符引用可以用来代替相应的 Unicode 字符，但有以下例外：

- 实体和字符引用在代码块和代码跨度中不被识别。

- 实体和字符引用不能代替定义 CommonMark 中结构元素的特殊字符。例如，虽然 \`&#42;\` 可以用来代替字面 \`*\` 字符，但 \`&#42;\` 不能替换强调定界符、项目符号列表标记或分隔线中的 \`*\`。

符合 CommonMark 的解析器不需要存储关于特定字符是使用 Unicode 字符还是实体引用在源中表示的信息。

[实体引用](@) 由 \`&\` + 任何有效的 HTML5 实体名称 + \`;\` 组成。文档 <https://html.spec.whatwg.org/multipage/entities.json> 被用作有效实体引用及其相应代码点的权威来源。

\`\`\`example
&nbsp; &amp; &copy; &AElig; &Dcaron;
&frac34; &HilbertSpace; &DifferentialD;
&ClockwiseContourIntegral; &ngE;
.
<p>  &amp; © Æ Ď
¾ ℋ ⅆ
∲ ≧̸</p>
\`\`\`

[十进制数字字符引用](@) 由 \`&#\` + 1-7 个阿拉伯数字字符串 + \`;\` 组成。数字字符引用被解析为相应的 Unicode 字符。无效的 Unicode 代码点将被替换字符 (\`U+FFFD\`) 替换。出于安全原因，代码点 \`U+0000\` 也将被 \`U+FFFD\` 替换。

\`\`\`example
&#35; &#1234; &#992; &#0;
.
<p># Ӓ Ϡ �</p>
\`\`\`

[十六进制数字字符引用](@) 由 \`&#\` + \`X\` 或 \`x\` + 1-6 个十六进制数字字符串 + \`;\` 组成。它们也被解析为相应的 Unicode 字符 (这次用十六进制数字而不是十进制指定)。

\`\`\`example
&#X22; &#XD06; &#xcab;
.
<p>&quot; ആ ಫ</p>
\`\`\`

以下是一些非实体：

\`\`\`example
&nbsp &x; &#; &#x;
&#987654321;
&#abcdef0;
&ThisIsNotDefined; &hi?;
.
<p>&amp;nbsp &amp;x; &amp;#; &amp;#x;
&amp;#987654321;
&amp;#abcdef0;
&amp;ThisIsNotDefined; &amp;hi?;</p>
\`\`\`

虽然 HTML5 确实接受一些没有尾随分号的实体引用 (例如 \`&copy\`)，但这里不识别它们，因为这会使语法过于模糊：

\`\`\`example
&copy
.
<p>&amp;copy</p>
\`\`\`

不在 HTML5 命名实体列表中的字符串也不被识别为实体引用：

\`\`\`example
&MadeUpEntity;
.
<p>&amp;MadeUpEntity;</p>
\`\`\`

实体和数字字符引用在除代码跨度或代码块之外的任何上下文中都被识别，包括 URL、[链接标题] 和 [围栏代码块][] 的 [info 字符串]：

\`\`\`example
<a href="&ouml;&ouml;.html">
.
<a href="&ouml;&ouml;.html">
\`\`\`

\`\`\`example
[foo](/f&ouml;&ouml; "f&ouml;&ouml;")
.
<p><a href="/f%C3%B6%C3%B6" title="föö">foo</a></p>
\`\`\`

\`\`\`example
[foo]

[foo]: /f&ouml;&ouml; "f&ouml;&ouml;"
.
<p><a href="/f%C3%B6%C3%B6" title="föö">foo</a></p>
\`\`\`

\`\`\`\`example
\`\`\` f&ouml;&ouml;
foo
\`\`\`
.
<pre><code class="language-föö">foo
</code></pre>
\`\`\`\`

实体和数字字符引用在代码跨度和代码块中被视为字面文本：

\`\`\`example
\`f&ouml;&ouml;\`
.
<p><code>f&amp;ouml;&amp;ouml;</code></p>
\`\`\`

\`\`\`example
    f&ouml;f&ouml;
.
<pre><code>f&amp;ouml;f&amp;ouml;
</code></pre>
\`\`\`

实体和数字字符引用不能用来代替 CommonMark 文档中指示结构的符号。

\`\`\`example
&#42;foo&#42;
*foo*
.
<p>*foo*
<em>foo</em></p>
\`\`\`

\`\`\`example
&#42; foo

* foo
.
<p>* foo</p>
<ul>
<li>foo</li>
</ul>
\`\`\`

\`\`\`example
foo&#10;&#10;bar
.
<p>foo

bar</p>
\`\`\`

\`\`\`example
&#9;foo
.
<p>→foo</p>
\`\`\`

\`\`\`example
[a](url &quot;tit&quot;)
.
<p>[a](url &quot;tit&quot;)</p>
\`\`\`

## 代码跨度 (Code spans)

[反引号字符串](@) 是一个或多个反引号字符 (\`\` \` \`\`) 的字符串，前后都没有反引号。

[代码跨度](@) 以反引号字符串开始，并以等长的反引号字符串结束。代码跨度的内容是两个反引号字符串之间的字符，以以下方式规范化：

- 首先，[行尾] 被转换为 [空格]。
- 如果结果字符串 _既_ 以 [空格] 字符开始 _又_ 以 [空格] 字符结束，但不完全由 [空格] 字符组成，则从前面和后面各删除一个 [空格] 字符。这允许您包含以反引号字符开始或结束的代码，这些字符必须用空白与开启或关闭反引号字符串分隔。

这是一个简单的代码跨度：

\`\`\`example
\`foo\`
.
<p><code>foo</code></p>
\`\`\`

这里使用了两个反引号，因为代码包含一个反引号。此示例还说明了去除单个前导和尾随空格：

\`\`\`example
\`\` foo \` bar \`\`
.
<p><code>foo \` bar</code></p>
\`\`\`

此示例展示了去除前导和尾随空格的动机：

\`\`\`example
\` \`\` \`
.
<p><code>\`\`</code></p>
\`\`\`

请注意，只去除 _一个_ 空格：

\`\`\`example
\`  \`\`  \`
.
<p><code> \`\` </code></p>
\`\`\`

只有当空格在字符串的两侧时才会去除：

\`\`\`example
\` a\`
.
<p><code> a</code></p>
\`\`\`

只有 [空格]，而不是一般的 [unicode 空白]，才会以这种方式去除：

\`\`\`example
\` b \`
.
<p><code> b </code></p>
\`\`\`

如果代码跨度仅包含空格，则不会去除：

\`\`\`example
\` \`
\`  \`
.
<p><code> </code>
<code>  </code></p>
\`\`\`

[行尾] 被视为空格：

\`\`\`example
\`\`
foo
bar
baz
\`\`
.
<p><code>foo bar   baz</code></p>
\`\`\`

\`\`\`example
\`\`
foo
\`\`
.
<p><code>foo </code></p>
\`\`\`

内部空格不会折叠：

\`\`\`example
\`foo   bar
baz\`
.
<p><code>foo   bar  baz</code></p>
\`\`\`

请注意，浏览器在呈现 \`<code>\` 元素时通常会折叠连续空格，因此建议使用以下 CSS：

    code{white-space: pre-wrap;}

请注意，反斜杠转义在代码跨度中不起作用。所有反斜杠都被视为字面意思：

\`\`\`example
\`foo\\\`bar\`
.
<p><code>foo\\</code>bar\`</p>
\`\`\`

永远不需要反斜杠转义，因为总是可以选择 _n_ 个反引号字符的字符串作为定界符，其中代码不包含任何恰好 _n_ 个反引号字符的字符串。

\`\`\`example
\`\`foo\`bar\`\`
.
<p><code>foo\`bar</code></p>
\`\`\`

\`\`\`example
\` foo \`\` bar \`
.
<p><code>foo \`\` bar</code></p>
\`\`\`

代码跨度反引号的优先级高于除 HTML 标签和自动链接之外的任何其他内联结构。因此，例如，这不会被解析为强调文本，因为第二个 \`*\` 是代码跨度的一部分：

\`\`\`example
*foo\`*\`
.
<p>*foo<code>*</code></p>
\`\`\`

这不会被解析为链接：

\`\`\`example
[不是 \`link](/foo\`)
.
<p>[不是 <code>link](/foo</code>)</p>
\`\`\`

代码跨度、HTML 标签和自动链接具有相同的优先级。因此，这是代码：

\`\`\`example
\`<a href="\`">\`
.
<p><code>&lt;a href=&quot;</code>&quot;&gt;\`</p>
\`\`\`

但这是一个 HTML 标签：

\`\`\`example
<a href="\`">\`
.
<p><a href="\`">\`</p>
\`\`\`

这是代码：

\`\`\`example
\`<http://foo.bar.\`baz>\`
.
<p><code>&lt;http://foo.bar.</code>baz&gt;\`</p>
\`\`\`

但这是一个自动链接：

\`\`\`example
<http://foo.bar.\`baz>\`
.
<p><a href="http://foo.bar.%60baz">http://foo.bar.\`baz</a>\`</p>
\`\`\`

当反引号字符串未被匹配的反引号字符串关闭时，我们只有字面反引号：

\`\`\`\`example
\`\`\`foo\`\`
.
<p>\`\`\`foo\`\`</p>
\`\`\`\`

\`\`\`example
\`foo
.
<p>\`foo</p>
\`\`\`

以下情况也说明了开启和关闭反引号字符串长度相等的必要性：

\`\`\`example
\`foo\`\`bar\`\`
.
<p>\`foo<code>bar</code></p>
\`\`\`

## 强调和加粗 (Emphasis and strong emphasis)

John Gruber 的原始 [Markdown 语法描述](http://daringfireball.net/projects/markdown/syntax#em) 说：

> Markdown 将星号 (\`*\`) 和下划线 (\`_\`) 视为强调的指示符。用一个 \`*\` 或 \`_\` 包裹的文本将用 HTML \`<em>\` 标签包裹；双 \`*\` 或 \`_\` 将用 HTML \`<strong>\` 标签包裹。

这对大多数用户来说已经足够了，但这些规则留下了很多未决定的内容，尤其是在涉及嵌套强调时。原始 \`Markdown.pl\` 测试套件明确表明三重 \`***\` 和 \`___\` 定界符可用于强调，大多数实现也允许以下模式：

\`\`\`markdown
**_strong emph_**
**\\*strong** in emph\\*
**_emph_ in strong**
**in strong _emph_**
\\*in emph **strong\\***
\`\`\`

以下模式的支持不太广泛，但意图很清楚，它们很有用 (尤其是在书目条目等上下文中)：

\`\`\`markdown
*强调 *包含强调* 在内*
**加粗 **包含加粗** 在内**
\`\`\`

许多实现还将词内强调限制为 \`*\` 形式，以避免在包含内部下划线的单词中出现不需要的强调。(最佳做法是将这些放在代码跨度中，但用户通常不会这样做。)

\`\`\`markdown
词内强调：foo*bar*baz
无强调：foo_bar_baz
\`\`\`

下面给出的规则捕获了所有这些模式，同时允许不回溯的高效解析策略。

首先，一些定义。[定界符序列](@) 是一个或多个 \`*\` 字符的序列，前后都没有非反斜杠转义的 \`*\` 字符，或者是一个或多个 \`_\` 字符的序列，前后都没有非反斜杠转义的 \`_\` 字符。

[左侧定界符序列](@) 是满足以下条件的 [定界符序列]：(1) 后面不跟 [Unicode 空白]，并且 (2a) 后面不跟 [标点字符]，或 (2b) 后面跟 [标点字符] 并且前面是 [Unicode 空白] 或 [标点字符]。出于此定义的目的，行的开头和结尾算作 Unicode 空白。

[右侧定界符序列](@) 是满足以下条件的 [定界符序列]：(1) 前面没有 [Unicode 空白]，并且 (2a) 前面没有 [标点字符]，或 (2b) 前面是 [标点字符] 并且后面跟 [Unicode 空白] 或 [标点字符]。出于此定义的目的，行的开头和结尾算作 Unicode 空白。

以下是定界符序列的一些示例。

- 左侧但非右侧：

  \`\`\`
  ***abc
    _abc
  **"abc"
   _"abc"
  \`\`\`

- 右侧但非左侧：

  \`\`\`
   abc***
   abc_
  "abc"**
  "abc"_
  \`\`\`

- 既是左侧又是右侧：

  \`\`\`
   abc***def
  "abc"_"def"
  \`\`\`

- 既非左侧也非右侧：

  \`\`\`
  abc *** def
  a _ b
  \`\`\`

(根据前后字符区分左侧和右侧定界符序列的想法来自 Roopesh Chander 的 [vfmd](http://www.vfmd.org/vfmd-spec/specification/#procedure-for-identifying-emphasis-tags)。vfmd 使用术语"强调指示符字符串"而不是"定界符序列"，其区分左侧和右侧序列的规则比这里给出的稍微复杂一些。)

以下规则定义强调和加粗：

1.  单个 \`*\` 字符 [可以开启强调](@) 当且仅当它是 [左侧定界符序列] 的一部分。

2.  单个 \`_\` 字符 [可以开启强调] 当且仅当它是 [左侧定界符序列] 的一部分，并且 (a) 不是 [右侧定界符序列] 的一部分，或者 (b) 是前面有标点符号的 [右侧定界符序列] 的一部分。

3.  单个 \`*\` 字符 [可以关闭强调](@) 当且仅当它是 [右侧定界符序列] 的一部分。

4.  单个 \`_\` 字符 [可以关闭强调] 当且仅当它是 [右侧定界符序列] 的一部分，并且 (a) 不是 [左侧定界符序列] 的一部分，或者 (b) 是后面跟标点符号的 [左侧定界符序列] 的一部分。

5.  双 \`**\` [可以开启加粗](@) 当且仅当它是 [左侧定界符序列] 的一部分。

6.  双 \`__\` [可以开启加粗] 当且仅当它是 [左侧定界符序列] 的一部分，并且 (a) 不是 [右侧定界符序列] 的一部分，或者 (b) 是前面有标点符号的 [右侧定界符序列] 的一部分。

7.  双 \`**\` [可以关闭加粗](@) 当且仅当它是 [右侧定界符序列] 的一部分。

8.  双 \`__\` [可以关闭加粗] 当且仅当它是 [右侧定界符序列] 的一部分，并且 (a) 不是 [左侧定界符序列] 的一部分，或者 (b) 是后面跟标点符号的 [左侧定界符序列] 的一部分。

9.  强调以 [可以开启强调] 的定界符开始，以 [可以关闭强调] 的定界符结束，并使用与开启定界符相同的字符（\`_\` 或 \`*\`）。开启和关闭定界符必须属于不同的 [定界符序列]。如果其中一个定界符既可以开启又可以关闭强调，则包含开启和关闭定界符的定界符序列的长度之和不得是 3 的倍数，除非两个长度都是 3 的倍数。

10. 加粗以 [可以开启加粗] 的定界符开始，以 [可以关闭加粗] 的定界符结束，并使用与开启定界符相同的字符（\`_\` 或 \`*\`）。开启和关闭定界符必须属于不同的 [定界符序列]。如果其中一个定界符既可以开启又可以关闭加粗，则包含开启和关闭定界符的定界符序列的长度之和不得是 3 的倍数，除非两个长度都是 3 的倍数。

11. 字面 \`*\` 字符不能出现在 \`*\` 定界的强调或 \`**\` 定界的加粗的开头或结尾，除非它被反斜杠转义。

12. 字面 \`_\` 字符不能出现在 \`_\` 定界的强调或 \`__\` 定界的加粗的开头或结尾，除非它被反斜杠转义。

当上述规则 1-12 与多种解析兼容时，以下原则解决歧义：

13. 应该最小化嵌套数量。因此，例如，解释 \`<strong>...</strong>\` 总是优先于 \`<em><em>...</em></em>\`。

14. 解释 \`<em><strong>...</strong></em>\` 总是优先于 \`<strong><em>...</em></strong>\`。

15. 当两个潜在的强调或加粗跨度重叠时，即第二个在第一个结束之前开始并在第一个结束之后结束，第一个优先。因此，例如，\`*foo _bar* baz_\` 被解析为 \`<em>foo _bar</em> baz_\` 而不是 \`*foo <em>bar* baz</em>\`。

16. 当有两个具有相同关闭定界符的潜在强调或加粗跨度时，较短的那个（较晚开启的那个）优先。因此，例如，\`**foo **bar baz**\` 被解析为 \`**foo <strong>bar baz</strong>\` 而不是 \`<strong>foo **bar baz</strong>\`。

17. 内联代码跨度、链接、图像和 HTML 标签比强调更紧密地组合在一起。因此，当在包含这些元素之一的解释和不包含的解释之间进行选择时，前者总是获胜。因此，例如，\`*[foo*](bar)\` 被解析为 \`*<a href="bar">foo*</a>\` 而不是 \`<em>[foo</em>](bar)\`。

这些规则可以通过一系列示例来说明。

规则 1：

\`\`\`example
*foo bar*
.
<p><em>foo bar</em></p>
\`\`\`

这不是强调，因为开启的 \`*\` 后面跟着空白，因此不是 [左侧定界符序列] 的一部分：

\`\`\`example
a * foo bar*
.
<p>a * foo bar*</p>
\`\`\`

这不是强调，因为开启的 \`*\` 前面是字母数字，后面是标点符号，因此不是 [左侧定界符序列] 的一部分：

\`\`\`example
a*"foo"*
.
<p>a*&quot;foo&quot;*</p>
\`\`\`

Unicode 不间断空格也算作空白：

\`\`\`example
* a *
.
<p>* a *</p>
\`\`\`

允许使用 \`*\` 的词内强调：

\`\`\`example
foo*bar*
.
<p>foo<em>bar</em></p>
\`\`\`

\`\`\`example
5*6*78
.
<p>5<em>6</em>78</p>
\`\`\`

规则 2：

\`\`\`example
_foo bar_
.
<p><em>foo bar</em></p>
\`\`\`

这不是强调，因为开启的 \`_\` 后面跟着空白：

\`\`\`example
_ foo bar_
.
<p>_ foo bar_</p>
\`\`\`

这不是强调，因为开启的 \`_\` 前面是字母数字，后面是标点符号：

\`\`\`example
a_"foo"_
.
<p>a_&quot;foo&quot;_</p>
\`\`\`

不允许在单词内使用 \`_\` 强调：

\`\`\`example
foo_bar_
.
<p>foo_bar_</p>
\`\`\`

\`\`\`example
5_6_78
.
<p>5_6_78</p>
\`\`\`

\`\`\`example
пристаням_стремятся_
.
<p>пристаням_стремятся_</p>
\`\`\`

这里 \`_\` 不生成强调，因为第一个定界符序列是右侧而第二个是左侧：

\`\`\`example
aa_"bb"_cc
.
<p>aa_&quot;bb&quot;_cc</p>
\`\`\`

这是强调，即使开启定界符既是左侧又是右侧，因为它前面是标点符号：

\`\`\`example
foo-_(bar)_
.
<p>foo-<em>(bar)</em></p>
\`\`\`

规则 3：

这不是强调，因为关闭定界符与开启定界符不匹配：

\`\`\`example
_foo*
.
<p>_foo*</p>
\`\`\`

这不是强调，因为关闭 \`*\` 前面是空白：

\`\`\`example
*foo bar *
.
<p>*foo bar *</p>
\`\`\`

换行符也算作空白：

\`\`\`example
*foo bar
*
.
<p>*foo bar
*</p>
\`\`\`

这不是强调，因为第二个 \`*\` 前面是标点符号，后面是字母数字（因此它不是 [右侧定界符序列] 的一部分）：

\`\`\`example
*(*foo)
.
<p>*(*foo)</p>
\`\`\`

通过此示例可以更容易理解此限制的意义：

\`\`\`example
*(*foo*)*
.
<p><em>(<em>foo</em>)</em></p>
\`\`\`

允许使用 \`*\` 的词内强调：

\`\`\`example
*foo*bar
.
<p><em>foo</em>bar</p>
\`\`\`

规则 4：

这不是强调，因为关闭 \`_\` 前面是空白：

\`\`\`example
_foo bar _
.
<p>_foo bar _</p>
\`\`\`

这不是强调，因为第二个 \`_\` 前面是标点符号，后面是字母数字：

\`\`\`example
_(_foo)
.
<p>_(_foo)</p>
\`\`\`

这是强调内的强调：

\`\`\`example
_(_foo_)_
.
<p><em>(<em>foo</em>)</em></p>
\`\`\`

不允许在单词内使用 \`_\` 强调：

\`\`\`example
_foo_bar
.
<p>_foo_bar</p>
\`\`\`

\`\`\`example
_пристаням_стремятся
.
<p>_пристаням_стремятся</p>
\`\`\`

\`\`\`example
_foo_bar_baz_
.
<p><em>foo_bar_baz</em></p>
\`\`\`

这是强调，即使关闭定界符既是左侧又是右侧，因为它后面是标点符号：

\`\`\`example
_(bar)_.
.
<p><em>(bar)</em>.</p>
\`\`\`

规则 5：

\`\`\`example
**foo bar**
.
<p><strong>foo bar</strong></p>
\`\`\`

这不是加粗，因为开启定界符后面是空白：

\`\`\`example
** foo bar**
.
<p>** foo bar**</p>
\`\`\`

这不是加粗，因为开启 \`**\` 前面是字母数字，后面是标点符号，因此不是 [左侧定界符序列] 的一部分：

\`\`\`example
a**"foo"**
.
<p>a**&quot;foo&quot;**</p>
\`\`\`

允许使用 \`**\` 的词内加粗：

\`\`\`example
foo**bar**
.
<p>foo<strong>bar</strong></p>
\`\`\`

规则 6：

\`\`\`example
__foo bar__
.
<p><strong>foo bar</strong></p>
\`\`\`

这不是加粗，因为开启定界符后面是空白：

\`\`\`example
__ foo bar__
.
<p>__ foo bar__</p>
\`\`\`

换行符算作空白：

\`\`\`example
__
foo bar__
.
<p>__
foo bar__</p>
\`\`\`

这不是加粗，因为开启 \`__\` 前面是字母数字，后面是标点符号：

\`\`\`example
a__"foo"__
.
<p>a__&quot;foo&quot;__</p>
\`\`\`

禁止使用 \`__\` 的词内加粗：

\`\`\`example
foo__bar__
.
<p>foo__bar__</p>
\`\`\`

\`\`\`example
5__6__78
.
<p>5__6__78</p>
\`\`\`

\`\`\`example
пристаням__стремятся__
.
<p>пристаням__стремятся__</p>
\`\`\`

\`\`\`example
__foo, __bar__, baz__
.
<p><strong>foo, bar, baz</strong></p>
\`\`\`

这是加粗，即使开启定界符既是左侧又是右侧，因为它前面是标点符号：

\`\`\`example
foo-__(bar)__
.
<p>foo-<strong>(bar)</strong></p>
\`\`\`

规则 7：

这不是加粗，因为关闭定界符前面是空白：

\`\`\`example
**foo bar **
.
<p>**foo bar **</p>
\`\`\`

（也不能被解释为强调的 \`*foo bar *\`，因为规则 11。）

这不是加粗，因为第二个 \`**\` 前面是标点符号，后面是字母数字：

\`\`\`example
**(**foo)
.
<p>**(**foo)</p>
\`\`\`

通过这些示例可以更容易理解此限制的意义：

\`\`\`example
*(**foo**)*
.
<p><em>(<strong>foo</strong>)</em></p>
\`\`\`

\`\`\`example
**Gomphocarpus (*Gomphocarpus physocarpus*, syn.
*Asclepias physocarpa*)**
.
<p><strong>Gomphocarpus (<em>Gomphocarpus physocarpus</em>, syn.
<em>Asclepias physocarpa</em>)</strong></p>
\`\`\`

\`\`\`example
**foo "*bar*" foo**
.
<p><strong>foo &quot;<em>bar</em>&quot; foo</strong></p>
\`\`\`

词内强调：

\`\`\`example
**foo**bar
.
<p><strong>foo</strong>bar</p>
\`\`\`

规则 8：

这不是加粗，因为关闭定界符前面是空白：

\`\`\`example
__foo bar __
.
<p>__foo bar __</p>
\`\`\`

这不是加粗，因为第二个 \`__\` 前面是标点符号，后面是字母数字：

\`\`\`example
__(__foo)
.
<p>__(__foo)</p>
\`\`\`

通过此示例可以更容易理解此限制的意义：

\`\`\`example
_(__foo__)_
.
<p><em>(<strong>foo</strong>)</em></p>
\`\`\`

禁止使用 \`__\` 的词内加粗：

\`\`\`example
__foo__bar
.
<p>__foo__bar</p>
\`\`\`

\`\`\`example
__пристаням__стремятся
.
<p>__пристаням__стремятся</p>
\`\`\`

\`\`\`example
__foo__bar__baz__
.
<p><strong>foo__bar__baz</strong></p>
\`\`\`

这是加粗，即使关闭定界符既是左侧又是右侧，因为它后面是标点符号：

\`\`\`example
__(bar)__.
.
<p><strong>(bar)</strong>.</p>
\`\`\`

规则 9：

任何非空的内联元素序列都可以作为强调跨度的内容。

\`\`\`example
*foo [bar](/url)*
.
<p><em>foo <a href="/url">bar</a></em></p>
\`\`\`

\`\`\`example
*foo
bar*
.
<p><em>foo
bar</em></p>
\`\`\`

特别是，强调和加粗可以嵌套在强调内部：

\`\`\`example
_foo __bar__ baz_
.
<p><em>foo <strong>bar</strong> baz</em></p>
\`\`\`

\`\`\`example
_foo _bar_ baz_
.
<p><em>foo <em>bar</em> baz</em></p>
\`\`\`

\`\`\`example
__foo_ bar_
.
<p><em><em>foo</em> bar</em></p>
\`\`\`

\`\`\`example
*foo *bar**
.
<p><em>foo <em>bar</em></em></p>
\`\`\`

\`\`\`example
*foo **bar** baz*
.
<p><em>foo <strong>bar</strong> baz</em></p>
\`\`\`

\`\`\`example
*foo**bar**baz*
.
<p><em>foo<strong>bar</strong>baz</em></p>
\`\`\`

请注意，在前面的情况中，解释

\`\`\`markdown
<p><em>foo</em><em>bar<em></em>baz</em></p>
\`\`\`

被排除的条件是：既可以开启又可以关闭的定界符（如 \`foo\` 后的 \`*\`）不能形成强调，如果包含开启和关闭定界符的定界符序列的长度之和是 3 的倍数，除非两个长度都是 3 的倍数。

出于同样的原因，在此示例中我们不会得到两个连续的强调部分：

\`\`\`example
*foo**bar*
.
<p><em>foo**bar</em></p>
\`\`\`

同样的条件确保以下情况都是嵌套在强调内部的加粗，即使省略了内部空格：

\`\`\`example
***foo** bar*
.
<p><em><strong>foo</strong> bar</em></p>
\`\`\`

\`\`\`example
*foo **bar***
.
<p><em>foo <strong>bar</strong></em></p>
\`\`\`

\`\`\`example
*foo**bar***
.
<p><em>foo<strong>bar</strong></em></p>
\`\`\`

然而，当内部关闭和开启定界符序列的长度 _都是_ 3 的倍数时，它们可以匹配以创建强调：

\`\`\`example
foo***bar***baz
.
<p>foo<em><strong>bar</strong></em>baz</p>
\`\`\`

\`\`\`example
foo******bar*********baz
.
<p>foo<strong>bar</strong>***baz</p>
\`\`\`

可以有无限层级的嵌套：

\`\`\`example
*foo **bar *baz* bim** bop*
.
<p><em>foo <strong>bar <em>baz</em> bim</strong> bop</em></p>
\`\`\`

\`\`\`example
*foo [*bar*](/url)*
.
<p><em>foo <a href="/url"><em>bar</em></a></em></p>
\`\`\`

不能有空强调或空加粗：

\`\`\`example
** 不是空强调
.
<p>** 不是空强调</p>
\`\`\`

\`\`\`example
**** 不是空加粗
.
<p>**** 不是空加粗</p>
\`\`\`

规则 10：

任何非空的内联元素序列都可以作为加粗跨度的内容。

\`\`\`example
**foo [bar](/url)**
.
<p><strong>foo <a href="/url">bar</a></strong></p>
\`\`\`

\`\`\`example
**foo
bar**
.
<p><strong>foo
bar</strong></p>
\`\`\`

特别是，强调和加粗可以嵌套在加粗内部：

\`\`\`example
__foo _bar_ baz__
.
<p><strong>foo <em>bar</em> baz</strong></p>
\`\`\`

\`\`\`example
__foo __bar__ baz__
.
<p><strong>foo bar baz</strong></p>
\`\`\`

\`\`\`example
____foo__ bar__
.
<p><strong>foo bar</strong></p>
\`\`\`

\`\`\`example
**foo **bar****
.
<p><strong>foo bar</strong></p>
\`\`\`

\`\`\`example
**foo *bar* baz**
.
<p><strong>foo <em>bar</em> baz</strong></p>
\`\`\`

\`\`\`example
**foo*bar*baz**
.
<p><strong>foo<em>bar</em>baz</strong></p>
\`\`\`

\`\`\`example
***foo* bar**
.
<p><strong><em>foo</em> bar</strong></p>
\`\`\`

\`\`\`example
**foo *bar***
.
<p><strong>foo <em>bar</em></strong></p>
\`\`\`

可以有无限层级的嵌套：

\`\`\`example
**foo *bar **baz**
bim* bop**
.
<p><strong>foo <em>bar <strong>baz</strong>
bim</em> bop</strong></p>
\`\`\`

\`\`\`example
**foo [*bar*](/url)**
.
<p><strong>foo <a href="/url"><em>bar</em></a></strong></p>
\`\`\`

不能有空强调或空加粗：

\`\`\`example
__ 不是空强调
.
<p>__ 不是空强调</p>
\`\`\`

\`\`\`example
____ 不是空加粗
.
<p>____ 不是空加粗</p>
\`\`\`

规则 11：

\`\`\`example
foo ***
.
<p>foo ***</p>
\`\`\`

\`\`\`example
foo *\\**
.
<p>foo <em>*</em></p>
\`\`\`

\`\`\`example
foo *_*
.
<p>foo <em>_</em></p>
\`\`\`

\`\`\`example
foo *****
.
<p>foo *****</p>
\`\`\`

\`\`\`example
foo **\\***
.
<p>foo <strong>*</strong></p>
\`\`\`

\`\`\`example
foo **_**
.
<p>foo <strong>_</strong></p>
\`\`\`

请注意，当定界符不均匀匹配时，规则 11 确定多余的字面 \`*\` 字符将出现在强调之外，而不是内部：

\`\`\`example
**foo*
.
<p>*<em>foo</em></p>
\`\`\`

\`\`\`example
*foo**
.
<p><em>foo</em>*</p>
\`\`\`

\`\`\`example
***foo**
.
<p>*<strong>foo</strong></p>
\`\`\`

\`\`\`example
****foo*
.
<p>***<em>foo</em></p>
\`\`\`

\`\`\`example
**foo***
.
<p><strong>foo</strong>*</p>
\`\`\`

\`\`\`example
*foo****
.
<p><em>foo</em>***</p>
\`\`\`

规则 12：

\`\`\`example
foo ___
.
<p>foo ___</p>
\`\`\`

\`\`\`example
foo _\\__
.
<p>foo <em>_</em></p>
\`\`\`

\`\`\`example
foo _*_
.
<p>foo <em>*</em></p>
\`\`\`

\`\`\`example
foo _____
.
<p>foo _____</p>
\`\`\`

\`\`\`example
foo __\\___
.
<p>foo <strong>_</strong></p>
\`\`\`

\`\`\`example
foo __*__
.
<p>foo <strong>*</strong></p>
\`\`\`

\`\`\`example
__foo_
.
<p>_<em>foo</em></p>
\`\`\`

请注意，当定界符不均匀匹配时，规则 12 确定多余的字面 \`_\` 字符将出现在强调之外，而不是内部：

\`\`\`example
_foo__
.
<p><em>foo</em>_</p>
\`\`\`

\`\`\`example
___foo__
.
<p>_<strong>foo</strong></p>
\`\`\`

\`\`\`example
____foo_
.
<p>___<em>foo</em></p>
\`\`\`

\`\`\`example
__foo___
.
<p><strong>foo</strong>_</p>
\`\`\`

\`\`\`example
_foo____
.
<p><em>foo</em>___</p>
\`\`\`

规则 13 意味着，如果你想要强调直接嵌套在强调内部，你必须使用不同的定界符：

\`\`\`example
**foo**
.
<p><strong>foo</strong></p>
\`\`\`

\`\`\`example
*_foo_*
.
<p><em><em>foo</em></em></p>
\`\`\`

\`\`\`example
__foo__
.
<p><strong>foo</strong></p>
\`\`\`

\`\`\`example
_*foo*_
.
<p><em><em>foo</em></em></p>
\`\`\`

然而，加粗内部的加粗无需切换定界符即可实现：

\`\`\`example
****foo****
.
<p><strong>foo</strong></p>
\`\`\`

\`\`\`example
____foo____
.
<p><strong>foo</strong></p>
\`\`\`

规则 13 可以应用于任意长的定界符序列：

\`\`\`example
******foo******
.
<p><strong>foo</strong></p>
\`\`\`

规则 14：

\`\`\`example
***foo***
.
<p><em><strong>foo</strong></em></p>
\`\`\`

\`\`\`example
_____foo_____
.
<p><em><strong>foo</strong></em></p>
\`\`\`

规则 15：

\`\`\`example
*foo _bar* baz_
.
<p><em>foo _bar</em> baz_</p>
\`\`\`

\`\`\`example
*foo __bar *baz bim__ bam*
.
<p><em>foo <strong>bar *baz bim</strong> bam</em></p>
\`\`\`

规则 16：

\`\`\`example
**foo **bar baz**
.
<p>**foo <strong>bar baz</strong></p>
\`\`\`

\`\`\`example
*foo *bar baz*
.
<p>*foo <em>bar baz</em></p>
\`\`\`

规则 17：

\`\`\`example
*[bar*](/url)
.
<p>*<a href="/url">bar*</a></p>
\`\`\`

\`\`\`example
_foo [bar_](/url)
.
<p>_foo <a href="/url">bar_</a></p>
\`\`\`

\`\`\`example
*<img src="foo" title="*"/>
.
<p>*<img src="foo" title="*"/></p>
\`\`\`

\`\`\`example
**<a href="**">
.
<p>**<a href="**"></p>
\`\`\`

\`\`\`example
__<a href="__">
.
<p>__<a href="__"></p>
\`\`\`

\`\`\`example
*a \`*\`*
.
<p><em>a <code>*</code></em></p>
\`\`\`

\`\`\`example
_a \`_\`_
.
<p><em>a <code>_</code></em></p>
\`\`\`

\`\`\`example
**a<http://foo.bar/?q=**>
.
<p>**a<a href="http://foo.bar/?q=**">http://foo.bar/?q=**</a></p>
\`\`\`

\`\`\`example
__a<http://foo.bar/?q=__>
.
<p>__a<a href="http://foo.bar/?q=__">http://foo.bar/?q=__</a></p>
\`\`\`

<div class="extension">

## 删除线（扩展）(Strikethrough (extension))

GFM 启用了 \`strikethrough\` 扩展，提供了额外的强调类型。

删除线文本是用两个波浪号 (\`~\`) 包裹的任何文本。

\`\`\`example strikethrough
~~嗨~~ 你好，世界！
.
<p><del>嗨</del> 你好，世界！</p>
\`\`\`

与常规强调定界符一样，新段落将导致删除线解析停止：

\`\`\`example strikethrough
这~~有一个

新段落~~。
.
<p>这~~有一个</p>
<p>新段落~~。</p>
\`\`\`

</div>

## 链接 (Links)

链接包含 [链接文本]（可见文本）、[链接目标]（作为链接目标的 URI）以及可选的 [链接标题]。Markdown 中有两种基本类型的链接。在 [内联链接] 中，目标和标题紧跟在链接文本之后给出。在 [引用链接] 中，目标和标题在文档的其他地方定义。

[链接文本](@) 由用方括号（\`[\` 和 \`]\`）包围的零个或多个内联元素的序列组成。适用以下规则：

- 链接不得包含其他链接，无论任何嵌套级别。如果多个原本有效的链接定义嵌套在彼此内部，则使用最内层的定义。

- 仅当 (a) 方括号被反斜杠转义，或 (b) 它们作为匹配的方括号对出现，带有开方括号 \`[\`、零个或多个内联的序列以及闭方括号 \`]\` 时，方括号才允许出现在 [链接文本] 中。

- 反引号 [代码跨度]、[自动链接] 和原始 [HTML 标签] 比链接文本中的方括号绑定得更紧密。因此，例如，\`\` [foo\`]\` \`\` 不能是链接文本，因为第二个 \`]\` 是代码跨度的一部分。

- 链接文本中的方括号比 [强调和加粗] 的标记绑定得更紧密。因此，例如，\`*[foo*](url)\` 是一个链接。

[链接目标](@) 由以下任一组成：

- 开启 \`<\` 和关闭 \`>\` 之间的零个或多个字符的序列，不包含换行符或未转义的 \`<\` 或 \`>\` 字符，或

- 不以 \`<\` 开头、不包含 ASCII 空格或控制字符的非空字符序列，并且仅当 (a) 括号被反斜杠转义，或 (b) 它们是平衡的未转义括号对的一部分时才包含括号。（实现可能会对括号嵌套施加限制以避免性能问题，但至少应支持三层嵌套。）

[链接标题](@) 由以下任一组成：

- 直双引号字符（\`"\`）之间的零个或多个字符的序列，仅当 \`"\` 字符被反斜杠转义时才包含它，或

- 直单引号字符（\`'\`）之间的零个或多个字符的序列，仅当 \`'\` 字符被反斜杠转义时才包含它，或

- 匹配括号（\`(...)\`）之间的零个或多个字符的序列，仅当 \`(\` 或 \`)\` 字符被反斜杠转义时才包含它。

虽然 [链接标题] 可以跨越多行，但它们不能包含 [空行]。

一个 [内联链接](@) 由 [链接文本] 紧接左括号 \`(\`、可选的 [空白]、可选的 [链接目标]、可选的由 [空白] 与链接目标分隔的 [链接标题]、可选的 [空白] 以及右括号 \`)\` 组成。链接的文本由 [链接文本] 中包含的内联组成（不包括包围的方括号）。链接的 URI 由链接目标组成，如果存在，则排除包围的 \`<...>\`，反斜杠转义如上所述生效。链接的标题由链接标题组成，排除其包围的定界符，反斜杠转义如上所述生效。

这是一个简单的内联链接：

\`\`\`example
[link](/uri "title")
.
<p><a href="/uri" title="title">link</a></p>
\`\`\`

标题可以省略：

\`\`\`example
[link](/uri)
.
<p><a href="/uri">link</a></p>
\`\`\`

标题和目标都可以省略：

\`\`\`example
[link]()
.
<p><a href="">link</a></p>
\`\`\`

\`\`\`example
[link](<>)
.
<p><a href="">link</a></p>
\`\`\`

仅当目标包含在尖括号中时才可以包含空格：

\`\`\`example
[link](/my uri)
.
<p>[link](/my uri)</p>
\`\`\`

\`\`\`example
[link](</my uri>)
.
<p><a href="/my%20uri">link</a></p>
\`\`\`

目标不能包含换行符，即使包含在尖括号中：

\`\`\`example
[link](foo
bar)
.
<p>[link](foo
bar)</p>
\`\`\`

\`\`\`example
[link](<foo
bar>)
.
<p>[link](<foo
bar>)</p>
\`\`\`

如果目标包含在尖括号中，则可以包含 \`)\`：

\`\`\`example
[a](<b)c>)
.
<p><a href="b)c">a</a></p>
\`\`\`

包围链接的尖括号必须是未转义的：

\`\`\`example
[link](<foo\\>)
.
<p>[link](&lt;foo&gt;)</p>
\`\`\`

这些不是链接，因为开启尖括号未正确匹配：

\`\`\`example
[a](<b)c
[a](<b)c>
[a](<b>c)
.
<p>[a](&lt;b)c
[a](&lt;b)c&gt;
[a](<b>c)</p>
\`\`\`

链接目标内的括号可以被转义：

\`\`\`example
[link](\\(foo\\))
.
<p><a href="(foo)">link</a></p>
\`\`\`

只要平衡，允许任意数量的括号而无需转义：

\`\`\`example
[link](foo(and(bar)))
.
<p><a href="foo(and(bar))">link</a></p>
\`\`\`

但是，如果你有不平衡的括号，你需要转义或使用 \`<...>\` 形式：

\`\`\`example
[link](foo\\(and\\(bar\\))
.
<p><a href="foo(and(bar)">link</a></p>
\`\`\`

\`\`\`example
[link](<foo(and(bar)>)
.
<p><a href="foo(and(bar)">link</a></p>
\`\`\`

括号和其他符号也可以被转义，如 Markdown 中通常所做的那样：

\`\`\`example
[link](foo\\)\\:)
.
<p><a href="foo):">link</a></p>
\`\`\`

链接可以包含片段标识符和查询：

\`\`\`example
[link](#fragment)

[link](http://example.com#fragment)

[link](http://example.com?foo=3#frag)
.
<p><a href="#fragment">link</a></p>
<p><a href="http://example.com#fragment">link</a></p>
<p><a href="http://example.com?foo=3#frag">link</a></p>
\`\`\`

请注意，不可转义字符前的反斜杠只是一个反斜杠：

\`\`\`example
[link](foo\\bar)
.
<p><a href="foo%5Cbar">link</a></p>
\`\`\`

URL 转义应该在目标内部保持不变，因为所有 URL 转义的字符也是有效的 URL 字符。目标中的实体和数字字符引用将像往常一样被解析为相应的 Unicode 代码点。在编写为 HTML 时，这些可以选择性地进行 URL 转义，但本规范不强制对在 HTML 或其他格式中渲染 URL 的任何特定策略。渲染器可能对如何在输出中转义或规范化 URL 做出不同的决定。

\`\`\`example
[link](foo%20b&auml;)
.
<p><a href="foo%20b%C3%A4">link</a></p>
\`\`\`

请注意，因为标题通常可以被解析为目标，如果你尝试省略目标并保留标题，你会得到意外的结果：

\`\`\`example
[link]("title")
.
<p><a href="%22title%22">link</a></p>
\`\`\`

标题可以在单引号、双引号或括号中：

\`\`\`example
[link](/url "title")
[link](/url 'title')
[link](/url (title))
.
<p><a href="/url" title="title">link</a>
<a href="/url" title="title">link</a>
<a href="/url" title="title">link</a></p>
\`\`\`

反斜杠转义以及实体和数字字符引用可以在标题中使用：

\`\`\`example
[link](/url "title \\"&quot;")
.
<p><a href="/url" title="title &quot;&quot;">link</a></p>
\`\`\`

标题必须使用 [空白] 与链接分隔。其他 [Unicode 空白] (如不间断空格) 不起作用。

\`\`\`example
[link](/url "title")
.
<p><a href="/url%C2%A0%22title%22">link</a></p>
\`\`\`

嵌套的平衡引号不允许不转义：

\`\`\`example
[link](/url "title "and" title")
.
<p>[link](/url &quot;title &quot;and&quot; title&quot;)</p>
\`\`\`

但通过使用不同的引号类型可以轻松解决此问题：

\`\`\`example
[link](/url 'title "and" title')
.
<p><a href="/url" title="title &quot;and&quot; title">link</a></p>
\`\`\`

（注意：\`Markdown.pl\` 确实允许在双引号标题内使用双引号，其测试套件包含了演示此功能的测试。但很难看出这带来的额外复杂性有什么好的理由，因为已经有很多方法——反斜杠转义、实体和数字字符引用，或为包围标题使用不同的引号类型——来编写包含双引号的标题。\`Markdown.pl\` 对标题的处理有许多其他奇怪的特性。例如，它允许内联链接中的单引号标题，但不允许引用链接中的。并且，在引用链接而非内联链接中，它允许标题以 \`"\` 开头并以 \`)\` 结尾。\`Markdown.pl\` 1.0.1 甚至允许没有关闭引号的标题，尽管 1.0.2b8 不允许。采用一个在内联链接和链接引用定义中以相同方式工作的简单、合理的规则似乎更可取。）

[空白] 允许出现在目标和标题周围：

\`\`\`example
[link](   /uri
  "title"  )
.
<p><a href="/uri" title="title">link</a></p>
\`\`\`

但不允许在链接文本和后续括号之间：

\`\`\`example
[link] (/uri)
.
<p>[link] (/uri)</p>
\`\`\`

链接文本可以包含平衡的方括号，但不能包含不平衡的，除非它们被转义：

\`\`\`example
[link [foo [bar]]](/uri)
.
<p><a href="/uri">link [foo [bar]]</a></p>
\`\`\`

\`\`\`example
[link] bar](/uri)
.
<p>[link] bar](/uri)</p>
\`\`\`

\`\`\`example
[link [bar](/uri)
.
<p>[link <a href="/uri">bar</a></p>
\`\`\`

\`\`\`example
[link \\[bar](/uri)
.
<p><a href="/uri">link [bar</a></p>
\`\`\`

链接文本可以包含内联内容：

\`\`\`example
[link *foo **bar** \`#\`*](/uri)
.
<p><a href="/uri">link <em>foo <strong>bar</strong> <code>#</code></em></a></p>
\`\`\`

\`\`\`example
[![月亮](moon.jpg)](/uri)
.
<p><a href="/uri"><img src="moon.jpg" alt="月亮" /></a></p>
\`\`\`

但是，链接不能包含其他链接，无论任何嵌套级别。

\`\`\`example
[foo [bar](/uri)](/uri)
.
<p>[foo <a href="/uri">bar</a>](/uri)</p>
\`\`\`

\`\`\`example
[foo *[bar [baz](/uri)](/uri)*](/uri)
.
<p>[foo <em>[bar <a href="/uri">baz</a>](/uri)</em>](/uri)</p>
\`\`\`

\`\`\`example
![[[foo](uri1)](uri2)](uri3)
.
<p><img src="uri3" alt="[foo](uri2)" /></p>
\`\`\`

这些情况说明了链接文本组合优先于强调组合：

\`\`\`example
*[foo*](/uri)
.
<p>*<a href="/uri">foo*</a></p>
\`\`\`

\`\`\`example
[foo *bar](baz*)
.
<p><a href="baz*">foo *bar</a></p>
\`\`\`

请注意，_不是_ 链接一部分的方括号不具有优先权：

\`\`\`example
*foo [bar* baz]
.
<p><em>foo [bar</em> baz]</p>
\`\`\`

这些情况说明了 HTML 标签、代码跨度和自动链接优先于链接组合：

\`\`\`example
[foo <bar attr="](baz)">
.
<p>[foo <bar attr="](baz)"></p>
\`\`\`

\`\`\`example
[foo\`](/uri)\`
.
<p>[foo<code>](/uri)</code></p>
\`\`\`

\`\`\`example
[foo<http://example.com/?search=](uri)>
.
<p>[foo<a href="http://example.com/?search=%5D(uri)">http://example.com/?search=](uri)</a></p>
\`\`\`

有三种 [引用链接](@)：[完整](#full-reference-link)、[折叠](#collapsed-reference-link) 和 [快捷](#shortcut-reference-link)。

[完整引用链接](@) 由 [链接文本] 紧接 [链接标签] 组成，该标签 [匹配] 文档中其他地方的 [链接引用定义]。

[链接标签](@) 以左方括号 (\`[\`) 开始，以第一个未被反斜杠转义的右方括号 (\`]\`) 结束。这些方括号之间必须至少有一个 [非空白字符]。未转义的方括号字符不允许出现在 [链接标签] 的开启和关闭方括号内。链接标签在方括号内最多可以有 999 个字符。

一个标签 [匹配](@) 另一个标签的条件是它们的规范化形式相等。要规范化标签，去掉开启和关闭方括号，执行 _Unicode 大小写折叠_，去除前导和尾随 [空白]，并将连续的内部 [空白] 折叠为单个空格。如果有多个匹配的引用链接定义，使用文档中首先出现的那个。（在这种情况下发出警告是可取的。）

第一个链接标签的内容被解析为内联，用作链接的文本。链接的 URI 和标题由匹配的 [链接引用定义] 提供。

这是一个简单示例：

\`\`\`example
[foo][bar]

[bar]: /url "title"
.
<p><a href="/url" title="title">foo</a></p>
\`\`\`

[链接文本] 的规则与 [内联链接] 相同。因此：

链接文本可以包含平衡的方括号，但不能包含不平衡的，除非它们被转义：

\`\`\`example
[link [foo [bar]]][ref]

[ref]: /uri
.
<p><a href="/uri">link [foo [bar]]</a></p>
\`\`\`

\`\`\`example
[link \\[bar][ref]

[ref]: /uri
.
<p><a href="/uri">link [bar</a></p>
\`\`\`

链接文本可以包含内联内容：

\`\`\`example
[link *foo **bar** \`#\`*][ref]

[ref]: /uri
.
<p><a href="/uri">link <em>foo <strong>bar</strong> <code>#</code></em></a></p>
\`\`\`

\`\`\`example
[![moon](moon.jpg)][ref]

[ref]: /uri
.
<p><a href="/uri"><img src="moon.jpg" alt="月亮" /></a></p>
\`\`\`

但是，链接不能包含其他链接，无论任何嵌套级别。

\`\`\`example
[foo [bar](/uri)][ref]

[ref]: /uri
.
<p>[foo <a href="/uri">bar</a>]<a href="/uri">ref</a></p>
\`\`\`

\`\`\`example
[foo *bar [baz][ref]*][ref]

[ref]: /uri
.
<p>[foo <em>bar <a href="/uri">baz</a></em>]<a href="/uri">ref</a></p>
\`\`\`

（在上面的示例中，我们有两个 [快捷引用链接] 而不是一个 [完整引用链接]。）

以下情况说明了链接文本组合优先于强调组合：

\`\`\`example
*[foo*][ref]

[ref]: /uri
.
<p>*<a href="/uri">foo*</a></p>
\`\`\`

\`\`\`example
[foo *bar][ref]

[ref]: /uri
.
<p><a href="/uri">foo *bar</a></p>
\`\`\`

这些情况说明了 HTML 标签、代码跨度和自动链接优先于链接组合：

\`\`\`example
[foo <bar attr="][ref]">

[ref]: /uri
.
<p>[foo <bar attr="][ref]"></p>
\`\`\`

\`\`\`example
[foo\`][ref]\`

[ref]: /uri
.
<p>[foo<code>][ref]</code></p>
\`\`\`

\`\`\`example
[foo<http://example.com/?search=][ref]>

[ref]: /uri
.
<p>[foo<a href="http://example.com/?search=%5D%5Bref%5D">http://example.com/?search=][ref]</a></p>
\`\`\`

匹配不区分大小写：

\`\`\`example
[foo][BaR]

[bar]: /url "title"
.
<p><a href="/url" title="title">foo</a></p>
\`\`\`

使用 Unicode 大小写折叠：

\`\`\`example
[Толпой][Толпой] 是一个俄语单词。

[ТОЛПОЙ]: /url
.
<p><a href="/url">Толпой</a> 是一个俄语单词。</p>
\`\`\`

为了确定匹配，连续的内部 [空白] 被视为一个空格：

\`\`\`example
[Foo
  bar]: /url

[Baz][Foo bar]
.
<p><a href="/url">Baz</a></p>
\`\`\`

[链接文本] 和 [链接标签] 之间不允许有 [空白]：

\`\`\`example
[foo] [bar]

[bar]: /url "title"
.
<p>[foo] <a href="/url" title="title">bar</a></p>
\`\`\`

\`\`\`example
[foo]
[bar]

[bar]: /url "title"
.
<p>[foo]
<a href="/url" title="title">bar</a></p>
\`\`\`

这与 John Gruber 的原始 Markdown 语法描述不同，后者明确允许链接文本和链接标签之间的空白。它使引用链接与 [内联链接] 保持一致，后者（根据原始 Markdown 和本规范）在链接文本后不能有空白。更重要的是，它防止了连续 [快捷引用链接] 的意外捕获。如果允许链接文本和链接标签之间有空白，那么在下面的例子中我们将有一个单一的引用链接，而不是如预期的两个快捷引用链接：

\`\`\`markdown
[foo]
[bar]

[foo]: /url1
[bar]: /url2
\`\`\`

（请注意，[快捷引用链接] 是由 Gruber 本人在 \`Markdown.pl\` 的 beta 版本中引入的，但从未包含在官方语法描述中。没有快捷引用链接时，允许链接文本和链接标签之间有空格是无害的；但一旦引入快捷引用，允许这样做就太危险了，因为它经常导致意外的结果。）

当有多个匹配的 [链接引用定义] 时，使用第一个：

\`\`\`example
[foo]: /url1

[foo]: /url2

[bar][foo]
.
<p><a href="/url1">bar</a></p>
\`\`\`

请注意，匹配是在规范化字符串上执行的，而不是已解析的内联内容。因此，以下内容不匹配，即使标签定义了等效的内联内容：

\`\`\`example
[bar][foo\\!]

[foo!]: /url
.
<p>[bar][foo!]</p>
\`\`\`

[链接标签] 不能包含方括号，除非它们被反斜杠转义：

\`\`\`example
[foo][ref[]

[ref[]: /uri
.
<p>[foo][ref[]</p>
<p>[ref[]: /uri</p>
\`\`\`

\`\`\`example
[foo][ref[bar]]

[ref[bar]]: /uri
.
<p>[foo][ref[bar]]</p>
<p>[ref[bar]]: /uri</p>
\`\`\`

\`\`\`example
[[[foo]]]

[[[foo]]]: /url
.
<p>[[[foo]]]</p>
<p>[[[foo]]]: /url</p>
\`\`\`

\`\`\`example
[foo][ref\\[]

[ref\\[]: /uri
.
<p><a href="/uri">foo</a></p>
\`\`\`

请注意，在此示例中 \`]\` 未被反斜杠转义：

\`\`\`example
[bar\\\\]: /uri

[bar\\\\]
.
<p><a href="/uri">bar\\</a></p>
\`\`\`

[链接标签] 必须至少包含一个 [非空白字符]：

\`\`\`example
[]

[]: /uri
.
<p>[]</p>
<p>[]: /uri</p>
\`\`\`

\`\`\`example
[
 ]

[
 ]: /uri
.
<p>[
]</p>
<p>[
]: /uri</p>
\`\`\`

一个 [折叠引用链接](@) 由 [链接标签] 组成，该标签 [匹配] 文档中其他地方的 [链接引用定义]，后跟字符串 \`[]\`。第一个链接标签的内容被解析为内联，用作链接的文本。链接的 URI 和标题由匹配的引用链接定义提供。因此，\`[foo][]\` 等同于 \`[foo][foo]\`。

\`\`\`example
[foo][]

[foo]: /url "title"
.
<p><a href="/url" title="title">foo</a></p>
\`\`\`

\`\`\`example
[*foo* bar][]

[*foo* bar]: /url "title"
.
<p><a href="/url" title="title"><em>foo</em> bar</a></p>
\`\`\`

链接标签不区分大小写：

\`\`\`example
[Foo][]

[foo]: /url "title"
.
<p><a href="/url" title="title">Foo</a></p>
\`\`\`

与完整引用链接一样，两组方括号之间不允许有 [空白]：

\`\`\`example
[foo]
[]

[foo]: /url "title"
.
<p><a href="/url" title="title">foo</a>
[]</p>
\`\`\`

一个 [快捷引用链接](@) 由 [链接标签] 组成，该标签 [匹配] 文档中其他地方的 [链接引用定义]，并且后面没有跟 \`[]\` 或链接标签。第一个链接标签的内容被解析为内联，用作链接的文本。链接的 URI 和标题由匹配的链接引用定义提供。因此，\`[foo]\` 等同于 \`[foo][]\`。

\`\`\`example
[foo]

[foo]: /url "title"
.
<p><a href="/url" title="title">foo</a></p>
\`\`\`

\`\`\`example
[*foo* bar]

[*foo* bar]: /url "title"
.
<p><a href="/url" title="title"><em>foo</em> bar</a></p>
\`\`\`

\`\`\`example
[[*foo* bar]]

[*foo* bar]: /url "title"
.
<p>[<a href="/url" title="title"><em>foo</em> bar</a>]</p>
\`\`\`

\`\`\`example
[[bar [foo]

[foo]: /url
.
<p>[[bar <a href="/url">foo</a></p>
\`\`\`

链接标签不区分大小写：

\`\`\`example
[Foo]

[foo]: /url "title"
.
<p><a href="/url" title="title">Foo</a></p>
\`\`\`

链接文本后的空格应该被保留：

\`\`\`example
[foo] bar

[foo]: /url
.
<p><a href="/url">foo</a> bar</p>
\`\`\`

如果你只想要括号文本，可以反斜杠转义开启方括号以避免链接：

\`\`\`example
\\[foo]

[foo]: /url "title"
.
<p>[foo]</p>
\`\`\`

请注意，这是一个链接，因为链接标签以第一个后续关闭方括号结束：

\`\`\`example
[foo*]: /url

*[foo*]
.
<p>*<a href="/url">foo*</a></p>
\`\`\`

完整和折叠引用优先于快捷引用：

\`\`\`example
[foo][bar]

[foo]: /url1
[bar]: /url2
.
<p><a href="/url2">foo</a></p>
\`\`\`

\`\`\`example
[foo][]

[foo]: /url1
.
<p><a href="/url1">foo</a></p>
\`\`\`

内联链接也具有优先权：

\`\`\`example
[foo]()

[foo]: /url1
.
<p><a href="">foo</a></p>
\`\`\`

\`\`\`example
[foo](不是链接)

[foo]: /url1
.
<p><a href="/url1">foo</a>(不是链接)</p>
\`\`\`

在以下情况中，\`[bar][baz]\` 被解析为引用，\`[foo]\` 被解析为普通文本：

\`\`\`example
[foo][bar][baz]

[baz]: /url
.
<p>[foo]<a href="/url">bar</a></p>
\`\`\`

然而在这里，\`[foo][bar]\` 被解析为引用，因为 \`[bar]\` 已定义：

\`\`\`example
[foo][bar][baz]

[baz]: /url1
[bar]: /url2
.
<p><a href="/url2">foo</a><a href="/url1">baz</a></p>
\`\`\`

这里 \`[foo]\` 不被解析为快捷引用，因为它后面跟着链接标签（即使 \`[bar]\` 未定义）：

\`\`\`example
[foo][bar][baz]

[baz]: /url1
[foo]: /url2
.
<p>[foo]<a href="/url1">bar</a></p>
\`\`\`

## 图像 (Images)

图像的语法类似于链接的语法，有一个不同之处。我们有 [图像描述](@) 而不是 [链接文本]。其规则与 [链接文本] 相同，除了 (a) 图像描述以 \`![\` 而不是 \`[\` 开始，以及 (b) 图像描述可以包含链接。图像描述以内联元素作为其内容。当图像被渲染为 HTML 时，这通常用作图像的 \`alt\` 属性。

\`\`\`example
![foo](/url "title")
.
<p><img src="/url" alt="foo" title="title" /></p>
\`\`\`

\`\`\`example
![foo *bar*]

[foo *bar*]: train.jpg "火车与轨道"
.
<p><img src="train.jpg" alt="foo bar" title="火车与轨道" /></p>
\`\`\`

\`\`\`example
![foo ![bar](/url)](/url2)
.
<p><img src="/url2" alt="foo bar" /></p>
\`\`\`

\`\`\`example
![foo [bar](/url)](/url2)
.
<p><img src="/url2" alt="foo bar" /></p>
\`\`\`

尽管本规范关注的是解析而非渲染，但建议在渲染为 HTML 时，仅使用 [图像描述] 的纯字符串内容。请注意，在上面的示例中，alt 属性的值是 \`foo bar\`，而不是 \`foo [bar](/url)\` 或 \`foo <a href="/url">bar</a>\`。仅渲染纯字符串内容，不带格式。

\`\`\`example
![foo *bar*][]

[foo *bar*]: train.jpg "火车与轨道"
.
<p><img src="train.jpg" alt="foo bar" title="火车与轨道" /></p>
\`\`\`

\`\`\`example
![foo *bar*][foobar]

[FOOBAR]: train.jpg "train & tracks"
.
<p><img src="train.jpg" alt="foo bar" title="火车与轨道" /></p>
\`\`\`

\`\`\`example
![foo](train.jpg)
.
<p><img src="train.jpg" alt="foo" /></p>
\`\`\`

\`\`\`example
我的 ![foo bar](/path/to/train.jpg  "title"   )
.
<p>我的 <img src="/path/to/train.jpg" alt="foo bar" title="title" /></p>
\`\`\`

\`\`\`example
![foo](<url>)
.
<p><img src="url" alt="foo" /></p>
\`\`\`

\`\`\`example
![](/url)
.
<p><img src="/url" alt="" /></p>
\`\`\`

引用样式：

\`\`\`example
![foo][bar]

[bar]: /url
.
<p><img src="/url" alt="foo" /></p>
\`\`\`

\`\`\`example
![foo][bar]

[BAR]: /url
.
<p><img src="/url" alt="foo" /></p>
\`\`\`

折叠：

\`\`\`example
![foo][]

[foo]: /url "title"
.
<p><img src="/url" alt="foo" title="title" /></p>
\`\`\`

\`\`\`example
![*foo* bar][]

[*foo* bar]: /url "title"
.
<p><img src="/url" alt="foo bar" title="title" /></p>
\`\`\`

标签不区分大小写：

\`\`\`example
![Foo][]

[foo]: /url "title"
.
<p><img src="/url" alt="Foo" title="title" /></p>
\`\`\`

与引用链接一样，两组方括号之间不允许有 [空白]：

\`\`\`example
![foo]
[]

[foo]: /url "title"
.
<p><img src="/url" alt="foo" title="title" />
[]</p>
\`\`\`

快捷：

\`\`\`example
![foo]

[foo]: /url "title"
.
<p><img src="/url" alt="foo" title="title" /></p>
\`\`\`

\`\`\`example
![*foo* bar]

[*foo* bar]: /url "title"
.
<p><img src="/url" alt="foo bar" title="title" /></p>
\`\`\`

请注意，链接标签不能包含未转义的方括号：

\`\`\`example
![[foo]]

[[foo]]: /url "title"
.
<p>![[foo]]</p>
<p>[[foo]]: /url &quot;title&quot;</p>
\`\`\`

链接标签不区分大小写：

\`\`\`example
![Foo]

[foo]: /url "title"
.
<p><img src="/url" alt="Foo" title="title" /></p>
\`\`\`

如果你只想要字面 \`!\` 后跟括号文本，可以反斜杠转义开启 \`[\`：

\`\`\`example
!\\[foo]

[foo]: /url "title"
.
<p>![foo]</p>
\`\`\`

如果你想在字面 \`!\` 后有一个链接，反斜杠转义 \`!\`：

\`\`\`example
\\![foo]

[foo]: /url "title"
.
<p>!<a href="/url" title="title">foo</a></p>
\`\`\`

## 自动链接 (Autolinks)

[自动链接](@) 是 \`<\` 和 \`>\` 内的绝对 URI 和电子邮件地址。它们被解析为链接，URL 或电子邮件地址作为链接标签。

[URI 自动链接](@) 由 \`<\` 后跟 [绝对 URI] 再后跟 \`>\` 组成。它被解析为指向该 URI 的链接，URI 作为链接的标签。

对于本规范，[绝对 URI](@) 由 [方案] 后跟冒号（\`:\`）再后跟零个或多个字符组成，这些字符不包括 ASCII [空白] 和控制字符、\`<\` 和 \`>\`。如果 URI 包含这些字符，必须进行百分号编码（例如空格用 \`%20\`）。

就本规范而言，[方案](@) 是以 ASCII 字母开头，后跟 ASCII 字母、数字或符号加号（"+"）、句号（"."）或连字符（"-"）的任意组合的 2--32 个字符的任何序列。

以下是一些有效的自动链接：

\`\`\`example
<http://foo.bar.baz>
.
<p><a href="http://foo.bar.baz">http://foo.bar.baz</a></p>
\`\`\`

\`\`\`example
<http://foo.bar.baz/test?q=hello&id=22&boolean>
.
<p><a href="http://foo.bar.baz/test?q=hello&amp;id=22&amp;boolean">http://foo.bar.baz/test?q=hello&amp;id=22&amp;boolean</a></p>
\`\`\`

\`\`\`example
<irc://foo.bar:2233/baz>
.
<p><a href="irc://foo.bar:2233/baz">irc://foo.bar:2233/baz</a></p>
\`\`\`

大写也可以：

\`\`\`example
<MAILTO:FOO@BAR.BAZ>
.
<p><a href="MAILTO:FOO@BAR.BAZ">MAILTO:FOO@BAR.BAZ</a></p>
\`\`\`

请注意，就本规范而言，许多被视为 [绝对 URI] 的字符串不是有效的 URI，因为它们的方案未注册或其语法存在其他问题：

\`\`\`example
<a+b+c:d>
.
<p><a href="a+b+c:d">a+b+c:d</a></p>
\`\`\`

\`\`\`example
<made-up-scheme://foo,bar>
.
<p><a href="made-up-scheme://foo,bar">made-up-scheme://foo,bar</a></p>
\`\`\`

\`\`\`example
<http://../>
.
<p><a href="http://../">http://../</a></p>
\`\`\`

\`\`\`example
<localhost:5001/foo>
.
<p><a href="localhost:5001/foo">localhost:5001/foo</a></p>
\`\`\`

自动链接中不允许有空格：

\`\`\`example
<http://foo.bar/baz bim>
.
<p>&lt;http://foo.bar/baz bim&gt;</p>
\`\`\`

反斜杠转义在自动链接内不起作用：

\`\`\`example
<http://example.com/\\[\\>
.
<p><a href="http://example.com/%5C%5B%5C">http://example.com/\\[\\</a></p>
\`\`\`

[电子邮件自动链接](@) 由 \`<\` 后跟 [电子邮件地址] 再后跟 \`>\` 组成。链接的标签是电子邮件地址，URL 是 \`mailto:\` 后跟电子邮件地址。

对于本规范，[电子邮件地址](@) 是匹配 [HTML5 规范中的非规范性正则表达式](<https://html.spec.whatwg.org/multipage/forms.html#e-mail-state-(type=email)>) 的任何内容：

    /^[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?
    (?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

电子邮件自动链接的示例：

\`\`\`example
<foo@bar.example.com>
.
<p><a href="mailto:foo@bar.example.com">foo@bar.example.com</a></p>
\`\`\`

\`\`\`example
<foo+special@Bar.baz-bar0.com>
.
<p><a href="mailto:foo+special@Bar.baz-bar0.com">foo+special@Bar.baz-bar0.com</a></p>
\`\`\`

反斜杠转义在电子邮件自动链接内不起作用：

\`\`\`example
<foo\\+@bar.example.com>
.
<p>&lt;foo+@bar.example.com&gt;</p>
\`\`\`

这些不是自动链接：

\`\`\`example
<>
.
<p>&lt;&gt;</p>
\`\`\`

\`\`\`example
< http://foo.bar >
.
<p>&lt; http://foo.bar &gt;</p>
\`\`\`

\`\`\`example
<m:abc>
.
<p>&lt;m:abc&gt;</p>
\`\`\`

\`\`\`example
<foo.bar.baz>
.
<p>&lt;foo.bar.baz&gt;</p>
\`\`\`

\`\`\`example
http://example.com
.
<p>http://example.com</p>
\`\`\`

\`\`\`example
foo@bar.example.com
.
<p>foo@bar.example.com</p>
\`\`\`

<div class="extension">

## 自动链接（扩展）(Autolinks (extension))

GFM 启用了 \`autolink\` 扩展，自动链接将在更多情况下被识别。

[自动链接] 也可以在不需要使用 \`<\` 和 \`>\` 来定界它们的情况下构造，尽管它们将在较小的情况集下被识别。所有这些被识别的自动链接只能出现在行的开头、空白之后或任何定界字符 \`*\`、\`_\`、\`~\` 和 \`(\` 之后。

[扩展 www 自动链接](@) 将在找到文本 \`www.\` 后跟 [有效域名] 时被识别。[有效域名](@) 由字母数字字符、下划线（\`_\`）和连字符（\`-\`）的段组成，用句号（\`.\`）分隔。必须至少有一个句号，并且域名的最后两个段中不能出现下划线。

方案 \`http\` 将自动插入：

\`\`\`example autolink
www.commonmark.org
.
<p><a href="http://www.commonmark.org">www.commonmark.org</a></p>
\`\`\`

在 [有效域名] 之后，可以跟零个或多个非空格非 \`<\` 字符：

\`\`\`example autolink
访问 www.commonmark.org/help 获取更多信息。
.
<p>访问 <a href="http://www.commonmark.org/help">www.commonmark.org/help</a> 获取更多信息。</p>
\`\`\`

然后我们应用 [扩展自动链接路径验证](@) 如下：

尾随标点符号（特别是 \`?\`、\`!\`、\`.\`、\`,\`、\`:\`、\`*\`、\`_\` 和 \`~\`）将不被视为自动链接的一部分，尽管它们可以包含在链接的内部：

\`\`\`example autolink
访问 www.commonmark.org.

访问 www.commonmark.org/a.b.
.
<p>访问 <a href="http://www.commonmark.org">www.commonmark.org</a>.</p>
<p>访问 <a href="http://www.commonmark.org/a.b">www.commonmark.org/a.b</a>.</p>
\`\`\`

当自动链接以 \`)\` 结尾时，我们扫描整个自动链接以获取括号的总数。如果关闭括号的数量多于开启括号，我们不会将不匹配的尾随括号视为自动链接的一部分，以便于在括号内包含自动链接：

\`\`\`example autolink
www.google.com/search?q=Markup+(business)

www.google.com/search?q=Markup+(business)))

(www.google.com/search?q=Markup+(business))

(www.google.com/search?q=Markup+(business)
.
<p><a href="http://www.google.com/search?q=Markup+(business)">www.google.com/search?q=Markup+(business)</a></p>
<p><a href="http://www.google.com/search?q=Markup+(business)">www.google.com/search?q=Markup+(business)</a>))</p>
<p>(<a href="http://www.google.com/search?q=Markup+(business)">www.google.com/search?q=Markup+(business)</a>)</p>
<p>(<a href="http://www.google.com/search?q=Markup+(business)">www.google.com/search?q=Markup+(business)</a></p>
\`\`\`

此检查仅在链接以关闭括号 \`)\` 结尾时进行，因此如果括号仅在自动链接的内部，则不应用特殊规则：

\`\`\`example autolink
www.google.com/search?q=(business))+ok
.
<p><a href="http://www.google.com/search?q=(business))+ok">www.google.com/search?q=(business))+ok</a></p>
\`\`\`

如果自动链接以分号（\`;\`）结尾，我们检查它是否看起来像 [实体引用][entity references]；如果前面的文本是 \`&\` 后跟一个或多个字母数字字符。如果是，则将其从自动链接中排除：

\`\`\`example autolink
www.google.com/search?q=commonmark&hl=en

www.google.com/search?q=commonmark&hl;
.
<p><a href="http://www.google.com/search?q=commonmark&amp;hl=en">www.google.com/search?q=commonmark&amp;hl=en</a></p>
<p><a href="http://www.google.com/search?q=commonmark">www.google.com/search?q=commonmark</a>&amp;hl;</p>
\`\`\`

\`<\` 立即结束自动链接。

\`\`\`example autolink
www.commonmark.org/he<lp
.
<p><a href="http://www.commonmark.org/he">www.commonmark.org/he</a>&lt;lp</p>
\`\`\`

[扩展 URL 自动链接](@) 将在识别到方案 \`http://\`、\`https://\` 或 \`ftp://\` 之一后跟 [有效域名]，然后根据 [扩展自动链接路径验证] 跟零个或多个非空格非 \`<\` 字符时被识别：

\`\`\`example autolink
http://commonmark.org

(访问 https://encrypted.google.com/search?q=Markup+(business))

匿名 FTP 可在 ftp://foo.bar.baz 获取。
.
<p><a href="http://commonmark.org">http://commonmark.org</a></p>
<p>(访问 <a href="https://encrypted.google.com/search?q=Markup+(business)">https://encrypted.google.com/search?q=Markup+(business)</a>)</p>
<p>匿名 FTP 可在 <a href="ftp://foo.bar.baz">ftp://foo.bar.baz</a> 获取。</p>
\`\`\`

[扩展电子邮件自动链接](@) 将在任何文本节点中识别到电子邮件地址时被识别。电子邮件地址根据以下规则识别：

- 一个或多个字母数字字符，或 \`.\`、\`-\`、\`_\` 或 \`+\`。
- 一个 \`@\` 符号。
- 一个或多个字母数字字符，或 \`-\` 或 \`_\`，用句号（\`.\`）分隔。必须至少有一个句号。最后一个字符不能是 \`-\` 或 \`_\`。

方案 \`mailto:\` 将自动添加到生成的链接：

\`\`\`example autolink
foo@bar.baz
.
<p><a href="mailto:foo@bar.baz">foo@bar.baz</a></p>
\`\`\`

\`+\` 可以出现在 \`@\` 之前，但不能在之后。

\`\`\`example autolink
hello@mail+xyz.example 无效，但 hello+xyz@mail.example 有效。
.
<p>hello@mail+xyz.example 无效，但 <a href="mailto:hello+xyz@mail.example">hello+xyz@mail.example</a> 有效。</p>
\`\`\`

\`.\`、\`-\` 和 \`_\` 可以出现在 \`@\` 的两侧，但只有 \`.\` 可以出现在电子邮件地址的末尾，在这种情况下它不会被视为地址的一部分：

\`\`\`example autolink
a.b-c_d@a.b

a.b-c_d@a.b.

a.b-c_d@a.b-

a.b-c_d@a.b_
.
<p><a href="mailto:a.b-c_d@a.b">a.b-c_d@a.b</a></p>
<p><a href="mailto:a.b-c_d@a.b">a.b-c_d@a.b</a>.</p>
<p>a.b-c_d@a.b-</p>
<p>a.b-c_d@a.b_</p>
\`\`\`

</div>

## 原始 HTML (Raw HTML)

\`<\` 和 \`>\` 之间看起来像 HTML 标签的文本被解析为原始 HTML 标签，并将在 HTML 中渲染而不转义。标签和属性名称不限于当前的 HTML 标签，因此可以使用自定义标签（甚至例如 DocBook 标签）。

以下是标签的语法：

[标签名称](@) 由 ASCII 字母后跟零个或多个 ASCII 字母、数字或连字符（\`-\`）组成。

[属性](@) 由 [空白]、[属性名称] 和可选的 [属性值规范] 组成。

[属性名称](@) 由 ASCII 字母、\`_\` 或 \`:\` 后跟零个或多个 ASCII 字母、数字、\`_\`、\`.\`、\`:\` 或 \`-\` 组成。（注意：这是限制为 ASCII 的 XML 规范。HTML5 更宽松。）

[属性值规范](@) 由可选的 [空白]、\`=\` 字符、可选的 [空白] 和 [属性值] 组成。

[属性值](@) 由 [不带引号的属性值]、[单引号属性值] 或 [双引号属性值] 组成。

[不带引号的属性值](@) 是不包含 [空白]、\`"\`、\`'\`、\`=\`、\`<\`、\`>\` 或 \`\` \` \`\` 的非空字符串。

[单引号属性值](@) 由 \`'\`、零个或多个不包含 \`'\` 的字符和最后的 \`'\` 组成。

[双引号属性值](@) 由 \`"\`、零个或多个不包含 \`"\` 的字符和最后的 \`"\` 组成。

[开启标签](@) 由 \`<\` 字符、[标签名称]、零个或多个 [属性]、可选的 [空白]、可选的 \`/\` 字符和 \`>\` 字符组成。

[关闭标签](@) 由字符串 \`</\`、[标签名称]、可选的 [空白] 和字符 \`>\` 组成。

[HTML 注释](@) 由 \`<!--->\`、\`<!---->\`、或 \`<!--\`、不包含字符串 \`-->\` 的字符串和 \`-->\` 组成（参见 [HTML 规范](https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state)）。

[处理指令](@) 由字符串 \`<?\`、不包含字符串 \`?>\` 的字符串和字符串 \`?>\` 组成。

[声明](@) 由字符串 \`<!\`、由一个或多个大写 ASCII 字母组成的名称、[空白]、不包含字符 \`>\` 的字符串和字符 \`>\` 组成。

[CDATA 部分](@) 由字符串 \`<![CDATA[\`、不包含字符串 \`]]>\` 的字符串和字符串 \`]]>\` 组成。

[HTML 标签](@) 由 [开启标签]、[关闭标签]、[HTML 注释]、[处理指令]、[声明] 或 [CDATA 部分] 组成。

以下是一些简单的开启标签：

\`\`\`example
<a><bab><c2c>
.
<p><a><bab><c2c></p>
\`\`\`

空元素：

\`\`\`example
<a/><b2/>
.
<p><a/><b2/></p>
\`\`\`

允许 [空白]：

\`\`\`example
<a  /><b2
data="foo" >
.
<p><a  /><b2
data="foo" ></p>
\`\`\`

带属性：

\`\`\`example
<a foo="bar" bam = 'baz <em>"</em>'
_boolean zoop:33=zoop:33 />
.
<p><a foo="bar" bam = 'baz <em>"</em>'
_boolean zoop:33=zoop:33 /></p>
\`\`\`

可以使用自定义标签名称：

\`\`\`example
Foo <responsive-image src="foo.jpg" />
.
<p>Foo <responsive-image src="foo.jpg" /></p>
\`\`\`

非法标签名称，不被解析为 HTML：

\`\`\`example
<33> <__>
.
<p>&lt;33&gt; &lt;__&gt;</p>
\`\`\`

非法属性名称：

\`\`\`example
<a h*#ref="hi">
.
<p>&lt;a h*#ref=&quot;hi&quot;&gt;</p>
\`\`\`

非法属性值：

\`\`\`example
<a href="hi'> <a href=hi'>
.
<p>&lt;a href=&quot;hi'&gt; &lt;a href=hi'&gt;</p>
\`\`\`

非法 [空白]：

\`\`\`example
< a><
foo><bar/ >
<foo bar=baz
bim!bop />
.
<p>&lt; a&gt;&lt;
foo&gt;&lt;bar/ &gt;
&lt;foo bar=baz
bim!bop /&gt;</p>
\`\`\`

缺少 [空白]：

\`\`\`example
<a href='bar'title=title>
.
<p>&lt;a href='bar'title=title&gt;</p>
\`\`\`

关闭标签：

\`\`\`example
</a></foo >
.
<p></a></foo ></p>
\`\`\`

关闭标签中的非法属性：

\`\`\`example
</a href="foo">
.
<p>&lt;/a href=&quot;foo&quot;&gt;</p>
\`\`\`

注释：

\`\`\`example
foo <!-- 这是一个 --
注释 - 带连字符 -->
.
<p>foo <!-- 这是一个 --
注释 - 带连字符 --></p>
\`\`\`

\`\`\`example
foo <!--> foo -->

foo <!---> foo -->
.
<p>foo <!--> foo --&gt;</p>
<p>foo <!---> foo --&gt;</p>
\`\`\`

处理指令：

\`\`\`example
foo <?php echo $a; ?>
.
<p>foo <?php echo $a; ?></p>
\`\`\`

声明：

\`\`\`example
foo <!ELEMENT br EMPTY>
.
<p>foo <!ELEMENT br EMPTY></p>
\`\`\`

CDATA 部分：

\`\`\`example
foo <![CDATA[>&<]]>
.
<p>foo <![CDATA[>&<]]></p>
\`\`\`

实体和数字字符引用在 HTML 属性中被保留：

\`\`\`example
foo <a href="&ouml;">
.
<p>foo <a href="&ouml;"></p>
\`\`\`

反斜杠转义在 HTML 属性中不起作用：

\`\`\`example
foo <a href="\\*">
.
<p>foo <a href="\\*"></p>
\`\`\`

\`\`\`example
<a href="\\"">
.
<p>&lt;a href=&quot;&quot;&quot;&gt;</p>
\`\`\`

<div class="extension">

## 不允许的原始 HTML（扩展）(Disallowed Raw HTML (extension))

GFM 启用了 \`tagfilter\` 扩展，在渲染 HTML 输出时将过滤以下 HTML 标签：

- \`<title>\`
- \`<textarea>\`
- \`<style>\`
- \`<xmp>\`
- \`<iframe>\`
- \`<noembed>\`
- \`<noframes>\`
- \`<script>\`
- \`<plaintext>\`

过滤是通过将前导 \`<\` 替换为实体 \`&lt;\` 来完成的。特别选择这些标签是因为它们以独特的方式改变 HTML 的解释（即嵌套 HTML 的解释不同），这在其他渲染的 Markdown 内容的上下文中通常是不希望的。

所有其他 HTML 标签保持不变。

\`\`\`example tagfilter
<strong> <title> <style> <em>

<blockquote>
  <xmp> 是不允许的。  <XMP> 也是不允许的。
</blockquote>
.
<p><strong> &lt;title> &lt;style> <em></p>
<blockquote>
  &lt;xmp> 是不允许的。  &lt;XMP> 也是不允许的。
</blockquote>
\`\`\`

</div>

## 硬换行 (Hard line breaks)

不在代码跨度或 HTML 标签中的换行符，如果前面有两个或更多空格且不出现在块的末尾，则被解析为 [硬换行](@)（在 HTML 中渲染为 \`<br />\` 标签）：

\`\`\`example
foo
baz
.
<p>foo<br />
baz</p>
\`\`\`

为了获得更明显的替代方案，可以在 [行尾] 之前使用反斜杠代替两个空格：

\`\`\`example
foo\\
baz
.
<p>foo<br />
baz</p>
\`\`\`

可以使用两个以上的空格：

\`\`\`example
foo
baz
.
<p>foo<br />
baz</p>
\`\`\`

下一行开头的前导空格被忽略：

\`\`\`example
foo
     bar
.
<p>foo<br />
bar</p>
\`\`\`

\`\`\`example
foo\\
     bar
.
<p>foo<br />
bar</p>
\`\`\`

换行可以出现在强调、链接和其他允许内联内容的结构中：

\`\`\`example
*foo
bar*
.
<p><em>foo<br />
bar</em></p>
\`\`\`

\`\`\`example
*foo\\
bar*
.
<p><em>foo<br />
bar</em></p>
\`\`\`

换行不会出现在代码跨度内：

\`\`\`example
\`code
span\`
.
<p><code>code   span</code></p>
\`\`\`

\`\`\`example
\`code\\
span\`
.
<p><code>code\\ span</code></p>
\`\`\`

或 HTML 标签内：

\`\`\`example
<a href="foo
bar">
.
<p><a href="foo
bar"></p>
\`\`\`

\`\`\`example
<a href="foo\\
bar">
.
<p><a href="foo\\
bar"></p>
\`\`\`

硬换行用于分隔块内的内联内容。硬换行的两种语法都不能在段落或其他块元素的末尾使用：

\`\`\`example
foo\\
.
<p>foo\\</p>
\`\`\`

\`\`\`example
foo
.
<p>foo</p>
\`\`\`

\`\`\`example
### foo\\
.
<h3>foo\\</h3>
\`\`\`

\`\`\`example
### foo
.
<h3>foo</h3>
\`\`\`

## 软换行 (Soft line breaks)

常规换行 (不在代码跨度或 HTML 标签中) 如果前面没有两个或更多空格或反斜杠，则被解析为 [软换行](@)。(软换行可以在 HTML 中呈现为 [行尾] 或空格。在浏览器中结果将相同。在这里的示例中，将使用 [行尾]。)

\`\`\`example
foo
baz
.
<p>foo
baz</p>
\`\`\`

行尾和下一行开头的空格被删除：

\`\`\`example
foo
 baz
.
<p>foo
baz</p>
\`\`\`

符合规范的解析器可以将软换行在 HTML 中呈现为换行或空格。

渲染器也可以提供将软换行呈现为硬换行的选项。

## 文本内容 (Textual content)

未被上述规则给出解释的任何字符将被解析为纯文本内容。

\`\`\`example
你好 $.;'那里
.
<p>你好 $.;'那里</p>
\`\`\`

\`\`\`example
Foo χρῆν
.
<p>Foo χρῆν</p>
\`\`\`

内部空格按原样保留：

\`\`\`example
多个     空格
.
<p>多个     空格</p>
\`\`\`

<!-- END TESTS -->

# 附录：解析策略 (Appendix: A parsing strategy)

在本附录中，我们描述 CommonMark 参考实现中使用的解析策略的一些特性。

## 概述 (Overview)

解析分为两个阶段：

1. 在第一阶段，输入的行被消费，并构建文档的块结构——文档划分为段落、块引用、列表项等。文本被分配给这些块但不被解析。链接引用定义被解析并构建链接映射。

2. 在第二阶段，使用第 1 阶段构建的链接引用映射，段落和标题的原始文本内容被解析为 Markdown 内联元素（字符串、代码跨度、链接、强调等）的序列。

在处理的每个时间点，文档都表示为 **块** 的树。树的根是 \`document\` 块。\`document\` 可以有任意数量的其他块作为 **子块**。这些子块反过来又可以有其他块作为子块。块的最后一个子块通常被视为 **开放的**，这意味着后续的输入行可以改变其内容。(未开放的块是 **关闭的**。) 例如，这是一个可能的文档树，开放的块用箭头标记：

\`\`\`tree
-> document
  -> block_quote
       paragraph
         "天地玄黄\\n宇宙洪荒。"
    -> list (type=bullet tight=true bullet_char=-)
         list_item
           paragraph
             "日月 *盈昃*"
      -> list_item
        -> paragraph
             "辰宿列张"
\`\`\`

## 阶段 1：块结构 (Phase 1: block structure)

处理的每一行都会对这棵树产生影响。分析该行，根据其内容，文档可能以以下一种或多种方式更改：

1. 可以关闭一个或多个开放块。
2. 可以创建一个或多个新块作为最后一个开放块的子块。
3. 可以将文本添加到树上剩余的最后一个 (最深的) 开放块。

一旦以这种方式将一行合并到树中，就可以丢弃它，因此可以以流的方式读取输入。

对于每一行，我们遵循以下过程：

1. 首先，我们遍历开放块，从根文档开始，通过最后的子节点下降到最后一个开放块。每个块都强加了一个条件，如果要保持块开放，该行必须满足该条件。例如，块引用需要 \`>\` 字符。段落需要非空行。在此阶段，我们可能匹配所有或仅部分开放块。但我们还不能关闭不匹配的块，因为我们可能有 [惰性续行行]。

2. 接下来，在消费现有块的续行标记后，我们寻找新块的开始（例如块引用的 \`>\`）。如果我们遇到新块的开始，我们在将新块创建为最后一个匹配块的子块之前，关闭步骤 1 中未匹配的任何块。

3. 最后，我们查看该行的剩余部分（在块标记如 \`>\`、列表标记和缩进被消费之后）。这是可以合并到最后一个开放块（段落、代码块、标题或原始 HTML）中的文本。

当我们看到段落的一行是 [setext 标题下划线] 时，就形成了 Setext 标题。

当段落关闭时检测引用链接定义；解析累积的文本行以查看它们是否以一个或多个引用链接定义开头。任何剩余部分都成为普通段落。

我们可以通过考虑上面的树是如何由四行 Markdown 生成的来了解这是如何工作的：

\`\`\`markdown
> 天地玄黄
> 宇宙洪荒。
>
> - 日月 _盈昃_
> - 辰宿列张
\`\`\`

一开始，我们的文档模型只是：

\`\`\`tree
-> document
\`\`\`

我们文本的第一行：

\`\`\`markdown
> 天地玄黄
\`\`\`

导致创建一个 \`block_quote\` 块作为我们开放的 \`document\` 块的子块，以及一个 \`paragraph\` 块作为 \`block_quote\` 的子块。然后将文本添加到最后一个开放块 \`paragraph\`：

\`\`\`tree
-> document
  -> block_quote
    -> paragraph
         "天地玄黄"
\`\`\`

下一行：

\`\`\`markdown
宇宙洪荒。
\`\`\`

是开放的 \`paragraph\` 的"惰性续行"，因此它被添加到段落的文本中：

\`\`\`tree
-> document
  -> block_quote
    -> paragraph
         "天地玄黄\\n宇宙洪荒。"
\`\`\`

第三行：

\`\`\`markdown
> - 日月 _盈昃_
\`\`\`

导致 \`paragraph\` 块被关闭，并且一个新的 \`list\` 块作为 \`block_quote\` 的子块被打开。一个 \`list_item\` 也被添加为 \`list\` 的子块，一个 \`paragraph\` 作为 \`list_item\` 的子块。然后将文本添加到新的 \`paragraph\`：

\`\`\`tree
-> document
  -> block_quote
       paragraph
         "天地玄黄\\n宇宙洪荒。"
    -> list (type=bullet tight=true bullet_char=-)
      -> list_item
        -> paragraph
             "日月 *盈昃*"
\`\`\`

第四行：

\`\`\`markdown
> - 辰宿列张
\`\`\`

导致 \`list_item\` (及其子块 \`paragraph\`) 被关闭，并且一个新的 \`list_item\` 作为 \`list\` 的子块被打开。一个 \`paragraph\` 被添加为新 \`list_item\` 的子块，以包含文本。我们因此获得最终的树：

\`\`\`tree
-> document
  -> block_quote
       paragraph
         "天地玄黄\\n宇宙洪荒。"
    -> list (type=bullet tight=true bullet_char=-)
         list_item
           paragraph
             "日月 *盈昃*"
      -> list_item
        -> paragraph
             "辰宿列张"
\`\`\`

## 阶段 2：内联结构 (Phase 2: inline structure)

一旦所有输入都被解析，所有开放的块都被关闭。

然后我们"遍历树"，访问每个节点，并将段落和标题的原始字符串内容解析为内联。在此时，我们已经看到了所有链接引用定义，因此我们可以在进行时解析引用链接。

\`\`\`tree
document
  block_quote
    paragraph
      str "天地玄黄"
      softbreak
      str "宇宙洪荒。"
    list (type=bullet tight=true bullet_char=-)
      list_item
        paragraph
          str "日月 "
          emph
            str "盈昃"
      list_item
        paragraph
          str "辰宿列张"
\`\`\`

注意第一个段落中的 [行尾] 如何被解析为 \`softbreak\`，以及第一个列表项中的星号如何变成了 \`emph\`。

### 解析嵌套强调和链接的算法 (An algorithm for parsing nested emphasis and links)

到目前为止，内联解析中最棘手的部分是处理强调、加粗、链接和图像。这是使用以下算法完成的。

当我们解析内联内容并遇到以下情况时：

- 一串 \`*\` 或 \`_\` 字符，或者
- \`[\` 或 \`![\`

我们插入一个文本节点，其中这些符号作为其字面内容，并将指向此文本节点的指针添加到 [定界符栈](@)。

[定界符栈] 是一个双向链表。每个元素包含指向文本节点的指针，以及以下信息：

- 定界符类型 (\`[\`, \`![\`, \`*\`, \`_\`)
- 定界符数量
- 定界符是否"活动"（开始时全部活动）
- 定界符是潜在的开启符、潜在的关闭符，还是两者都是（这取决于定界符前后的字符类型）

当我们遇到 \`]\` 字符时，调用 _查找链接或图像_ 过程（见下文）。

当我们到达输入的末尾时，调用 _处理强调_ 过程（见下文），其中 \`stack_bottom\` = NULL。

#### _查找链接或图像 (look for link or image)_

从定界符栈的顶部开始，我们向后查找开启的 \`[\` 或 \`![\` 定界符。

- 如果找不到，我们返回一个字面文本节点 \`]\`。

- 如果找到了一个，但它不是 _活动的_，我们从栈中移除该非活动定界符，并返回一个字面文本节点 \`]\`。

- 如果找到了一个活动的，我们向前解析以查看是否有内联链接/图像、引用链接/图像、折叠引用链接/图像或快捷引用链接/图像。
  - 如果没有，我们从定界符栈中移除开启定界符并返回一个字面文本节点 \`]\`。

  - 如果有，则：
    - 我们返回一个链接或图像节点，其子节点是开启定界符指向的文本节点之后的内联内容。

    - 我们对这些内联内容运行 _处理强调_，以 \`[\` 开启符作为 \`stack_bottom\`。

    - 我们移除开启定界符。

    - 如果是链接（而非图像），我们还将开启定界符之前的所有 \`[\` 定界符设为 _非活动_。（这将防止链接内嵌套链接。）

#### _处理强调 (process emphasis)_

参数 \`stack_bottom\` 设置了我们在 [定界符栈] 中下降的下限。如果为 NULL，我们可以一直到底部。否则，我们在访问 \`stack_bottom\` 之前停止。

让 \`current_position\` 指向 [定界符栈] 中 \`stack_bottom\` 正上方的元素（如果 \`stack_bottom\` 为 NULL，则指向第一个元素）。

我们为每种定界符类型（\`*\`、\`_\`）和每个关闭定界符运行的长度（取模 3）跟踪 \`openers_bottom\`。将其初始化为 \`stack_bottom\`。

然后我们重复以下步骤，直到用尽潜在的关闭符：

- 在定界符栈中向前移动 \`current_position\`（如果需要），直到找到第一个带有定界符 \`*\` 或 \`_\` 的潜在关闭符。（这将是最接近输入开头的潜在关闭符——解析顺序中的第一个。）

- 现在，向后查找栈（保持在 \`stack_bottom\` 和此定界符类型的 \`openers_bottom\` 之上）以找到第一个匹配的潜在开启符（"匹配"意味着相同的定界符）。

- 如果找到：
  - 确定是强调还是加粗：如果关闭符和开启符跨度的长度都 >= 2，则为加粗，否则为普通强调。

  - 相应地在开启符对应的文本节点之后插入 emph 或 strong emph 节点。

  - 从定界符栈中移除开启符和关闭符之间的所有定界符。

  - 从开启和关闭文本节点中移除 1 个（普通强调）或 2 个（加粗）定界符。如果它们因此变为空，则移除它们并移除定界符栈中对应的元素。如果关闭节点被移除，将 \`current_position\` 重置为栈中的下一个元素。

- 如果未找到：
  - 将 \`openers_bottom\` 设为 \`current_position\` 之前的元素。（我们知道到此为止没有这种关闭符的开启符，因此这为将来的搜索设置了下限。）

  - 如果 \`current_position\` 处的关闭符不是潜在的开启符，则将其从定界符栈中移除（因为我们知道它也不能是关闭符）。

  - 将 \`current_position\` 前进到栈中的下一个元素。

完成后，我们从定界符栈中移除 \`stack_bottom\` 之上的所有定界符。
`;export{n as default};
