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
1. List item one.
+
List item one continued with a second paragraph followed by an
Indented block.
+
.................
$ ls *.sh
$ mv *.sh ~/tmp
.................
+
List item continued with a third paragraph.

2. List item two continued with an open block.
+
--
This paragraph is part of the preceding list item.

a. This list is nested and does not require explicit item
continuation.
+
This paragraph is part of the preceding list item.

b. List item b.

This paragraph belongs to item two of the outer list.
--
\`\`\`

以下是 Markdown 中的等效内容：

\`\`\`
1.  List item one.

    List item one continued with a second paragraph followed by an
    Indented block.

        $ ls *.sh
        $ mv *.sh ~/tmp

    List item continued with a third paragraph.

2.  List item two continued with an open block.

    This paragraph is part of the preceding list item.

    1. This list is nested and does not require explicit item continuation.

       This paragraph is part of the preceding list item.

    2. List item b.

    This paragraph belongs to item two of the outer list.
\`\`\`

可以说，AsciiDoc 版本更容易编写。您不需要担心缩进。但 Markdown 版本更易于阅读。在源文件中，列表项的嵌套对肉眼来说是显而易见的，而不仅仅是在处理后的文档中。

## 为什么需要规范？ (Why is a spec needed?)

John Gruber 对 [Markdown 语法的权威描述](http://daringfireball.net/projects/markdown/syntax) 并没有明确指定语法。以下是它没有回答的一些问题示例：

1.  子列表需要多少缩进？规范说明续行段落需要缩进四个空格，但对子列表并未完全明确。自然会认为子列表也必须缩进四个空格，但 \`Markdown.pl\` 并不要求如此。这绝非"边缘情况"，不同实现在此问题上的差异常常让用户在实际文档中感到意外。（参见 [John Gruber 的这条评论](https://web.archive.org/web/20170611172104/http://article.gmane.org/gmane.text.markdown.general/1997)。）

2.  块引用或标题前需要空行吗？大多数实现不要求空行。然而，这可能导致硬换行文本中的意外结果，以及解析歧义（注意某些实现将标题放在块引用内，而另一些则不会）。（John Gruber 也表达过[支持要求空行](https://web.archive.org/web/20170611172104/http://article.gmane.org/gmane.text.markdown.general/2146)的观点。）

3.  缩进代码块前需要空行吗？（\`Markdown.pl\` 要求，但文档中未提及，某些实现不要求。）

    \`\`\`markdown
    paragraph
    code?
    \`\`\`

4.  确定列表项何时被包裹在 \`<p>\` 标签中的确切规则是什么？列表可以部分"宽松"、部分"紧凑"吗？这样的列表应该如何处理？

    \`\`\`markdown
    1. one

    2. two
    3. three
    \`\`\`

    或者这个？

    \`\`\`markdown
    1.  one
        - a

        - b

    2.  two
    \`\`\`

    （John Gruber [在此](https://web.archive.org/web/20170611172104/http://article.gmane.org/gmane.text.markdown.general/2554)有一些相关评论。）

5.  列表标记可以缩进吗？有序列表标记可以右对齐吗？

    \`\`\`markdown
    8.  item 1
    9.  item 2
    10. item 2a
    \`\`\`

6.  这是一个在第二项中带有分隔线的列表，还是由分隔线分隔的两个列表？

    \`\`\`markdown
    - a

    ---

    - b
    \`\`\`

7.  当列表标记从数字变成项目符号时，是两个列表还是一个？（Markdown 语法描述暗示是两个，但 Perl 脚本和许多其他实现产生的是一个。）

    \`\`\`markdown
    1. fee
    2. fie

    - foe
    - fum
    \`\`\`

8.  内联结构标记的优先级规则是什么？例如，以下内容是有效链接，还是代码跨度优先？

    \`\`\`markdown
    [a backtick (\`)](/url) and [another backtick (\`)](/url).
    \`\`\`

9.  强调和加粗标记的优先级规则是什么？例如，以下内容应如何解析？

    \`\`\`markdown
    *foo *bar* baz*
    \`\`\`

10. 块级结构和内联结构之间的优先级规则是什么？例如，以下内容应如何解析？

    \`\`\`markdown
    - \`a long code span can contain a hyphen like this
      - and it can screw things up\`
    \`\`\`

11. 列表项可以包含章节标题吗？（\`Markdown.pl\` 不允许，但允许块引用包含标题。）

    \`\`\`markdown
    - # Heading
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

## ATX headings

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

## Setext headings

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

<a title="a lot
---
of dashes"/>
.
<h2>\`Foo</h2>
<p>\`</p>
<h2>&lt;a title=&quot;a lot</h2>
<p>of dashes&quot;/&gt;</p>
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

## Indented code blocks

[缩进代码块](@) 由一个或多个通过空行分隔的 [缩进块] 组成。[缩进块](@) 是一系列非空行，每行缩进四个或更多空格。代码块的内容是行的字面内容，包括尾随 [行尾]，减去四个空格的缩进。缩进代码块没有 [info 字符串]。

缩进代码块不能中断段落，因此段落和后面的缩进代码块之间必须有一个空行。(但是，代码块和后面的段落之间不需要空行。)

\`\`\`example
    a simple
      indented code block
.
<pre><code>a simple
  indented code block
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
    *hi*

    - one
.
<pre><code>&lt;a/&gt;
*hi*

- one
</code></pre>
\`\`\`

这里我们有三个由空行分隔的块：

\`\`\`example
    chunk1

    chunk2



    chunk3
.
<pre><code>chunk1

chunk2



chunk3
</code></pre>
\`\`\`

超过四个空格的任何初始空格都将包含在内容中，即使在内部空行中也是如此：

\`\`\`example
    chunk1

      chunk2
.
<pre><code>chunk1

  chunk2
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
# Heading
    foo
Heading
------
    foo
----
.
<h1>Heading</h1>
<pre><code>foo
</code></pre>
<h2>Heading</h2>
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

## Fenced code blocks

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

## HTML blocks

[HTML 块](@) 是被视为原始 HTML 的一组行 (在 HTML 输出中不会被转义)。

有七种 [HTML 块]，可以通过它们的开始和结束条件来定义。块以满足 [开始条件](@) 的行开始 (在最多三个空格的可选缩进之后)。它以满足匹配 [结束条件](@) 的第一个后续行结束，或文档的最后一行，或包含当前 HTML 块的 [容器块](#container-blocks) 的最后一行 (如果没有遇到满足 [结束条件] 的行)。如果第一行同时满足 [开始条件] 和 [结束条件]，则块将仅包含该行。

1.  **Start condition:** line begins with the string \`<script\`,
    \`<pre\`, or \`<style\` (case-insensitive), followed by whitespace,
    the string \`>\`, or the end of the line.\\
    **End condition:** line contains an end tag
    \`<\/script>\`, \`</pre>\`, or \`</style>\` (case-insensitive; it
    need not match the start tag).

2.  **Start condition:** line begins with the string \`<!--\`.\\
    **End condition:** line contains the string \`-->\`.

3.  **Start condition:** line begins with the string \`<?\`.\\
    **End condition:** line contains the string \`?>\`.

4.  **Start condition:** line begins with the string \`<!\`
    followed by an uppercase ASCII letter.\\
    **End condition:** line contains the character \`>\`.

5.  **Start condition:** line begins with the string
    \`<![CDATA[\`.\\
    **End condition:** line contains the string \`]]>\`.

6.  **Start condition:** line begins with the string \`<\` or \`</\`
    followed by one of the strings (case-insensitive) \`address\`,
    \`article\`, \`aside\`, \`base\`, \`basefont\`, \`blockquote\`, \`body\`,
    \`caption\`, \`center\`, \`col\`, \`colgroup\`, \`dd\`, \`details\`, \`dialog\`,
    \`dir\`, \`div\`, \`dl\`, \`dt\`, \`fieldset\`, \`figcaption\`, \`figure\`,
    \`footer\`, \`form\`, \`frame\`, \`frameset\`,
    \`h1\`, \`h2\`, \`h3\`, \`h4\`, \`h5\`, \`h6\`, \`head\`, \`header\`, \`hr\`,
    \`html\`, \`iframe\`, \`legend\`, \`li\`, \`link\`, \`main\`, \`menu\`, \`menuitem\`,
    \`nav\`, \`noframes\`, \`ol\`, \`optgroup\`, \`option\`, \`p\`, \`param\`,
    \`section\`, \`summary\`, \`table\`, \`tbody\`, \`td\`,
    \`tfoot\`, \`th\`, \`thead\`, \`title\`, \`tr\`, \`track\`, \`ul\`, followed
    by [whitespace], the end of the line, the string \`>\`, or
    the string \`/>\`.\\
    **End condition:** line is followed by a [blank line].

7.  **Start condition:** line begins with a complete [open tag]
    (with any [tag name] other than \`script\`,
    \`style\`, or \`pre\`) or a complete [closing tag],
    followed only by [whitespace] or the end of the line.\\
    **End condition:** line is followed by a [blank line].

HTML 块会持续到被适当的 [结束条件] 关闭，或文档的最后一行或其他 [容器块](#container-blocks)。这意味着 **HTML 块内的** 任何 HTML，如果在其他情况下可能被识别为开始条件，将被解析器忽略并按原样传递，而不改变解析器的状态。

例如，由 \`<table>\` 开始的 HTML 块内的 \`<pre>\` 不会影响解析器状态；由于 HTML 块是由开始条件 6 开始的，它将在任何空行处结束。这可能令人惊讶：

\`\`\`example
<table><tr><td>
<pre>
**Hello**,

_world_.
</pre>
</td></tr></table>
.
<table><tr><td>
<pre>
**Hello**,
<p><em>world</em>.
</pre></p>
</td></tr></table>
\`\`\`

在这种情况下，HTML 块被换行符终止 — \`**Hello**\` 文本保持原样 — 然后恢复常规解析，接下来是段落、强调的 \`world\` 以及内联和块 HTML。

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

okay.
.
<table>
  <tr>
    <td>
           hi
    </td>
  </tr>
</table>
<p>okay.</p>
\`\`\`

\`\`\`example
 <div>
  *hello*
         <foo><a>
.
 <div>
  *hello*
         <foo><a>
\`\`\`

A block can also start with a closing tag:

\`\`\`example
</div>
*foo*
.
</div>
*foo*
\`\`\`

Here we have two HTML blocks with a Markdown paragraph between them:

\`\`\`example
<DIV CLASS="foo">

*Markdown*

</DIV>
.
<DIV CLASS="foo">
<p><em>Markdown</em></p>
</DIV>
\`\`\`

The tag on the first line can be partial, as long
as it is split where there would be whitespace:

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

An open tag need not be closed:

\`\`\`example
<div>
*foo*

*bar*
.
<div>
*foo*
<p><em>bar</em></p>
\`\`\`

A partial tag need not even be completed (garbage
in, garbage out):

\`\`\`example
<div id="foo"
*hi*
.
<div id="foo"
*hi*
\`\`\`

\`\`\`example
<div class
foo
.
<div class
foo
\`\`\`

The initial tag doesn't even need to be a valid
tag, as long as it starts like one:

\`\`\`example
<div *???-&&&-<---
*foo*
.
<div *???-&&&-<---
*foo*
\`\`\`

In type 6 blocks, the initial tag need not be on a line by
itself:

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

Everything until the next blank line or end of document
gets included in the HTML block. So, in the following
example, what looks like a Markdown code block
is actually part of the HTML block, which continues until a blank
line or the end of the document is reached:

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

To start an [HTML block] with a tag that is _not_ in the
list of block-level tags in (6), you must put the tag by
itself on the first line (and it must be complete):

\`\`\`example
<a href="foo">
*bar*
</a>
.
<a href="foo">
*bar*
</a>
\`\`\`

In type 7 blocks, the [tag name] can be anything:

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

These rules are designed to allow us to work with tags that
can function as either block-level or inline-level tags.
The \`<del>\` tag is a nice example. We can surround content with
\`<del>\` tags in three different ways. In this case, we get a raw
HTML block, because the \`<del>\` tag is on a line by itself:

\`\`\`example
<del>
*foo*
</del>
.
<del>
*foo*
</del>
\`\`\`

In this case, we get a raw HTML block that just includes
the \`<del>\` tag (because it ends with the following blank
line). So the contents get interpreted as CommonMark:

\`\`\`example
<del>

*foo*

</del>
.
<del>
<p><em>foo</em></p>
</del>
\`\`\`

Finally, in this case, the \`<del>\` tags are interpreted
as [raw HTML] _inside_ the CommonMark paragraph. (Because
the tag is not on a line by itself, we get inline HTML
rather than an [HTML block].)

\`\`\`example
<del>*foo*</del>
.
<p><del><em>foo</em></del></p>
\`\`\`

HTML tags designed to contain literal content
(\`script\`, \`style\`, \`pre\`), comments, processing instructions,
and declarations are treated somewhat differently.
Instead of ending at the first blank line, these blocks
end at the first line containing a corresponding end tag.
As a result, these blocks can contain blank lines:

A pre tag (type 1):

\`\`\`example
<pre language="haskell"><code>
import Text.HTML.TagSoup

main :: IO ()
main = print $ parseTags tags
</code></pre>
okay
.
<pre language="haskell"><code>
import Text.HTML.TagSoup

main :: IO ()
main = print $ parseTags tags
</code></pre>
<p>okay</p>
\`\`\`

A script tag (type 1):

\`\`\`example
<script type="text/javascript">
// JavaScript example

document.getElementById("demo").innerHTML = "Hello JavaScript!";
<\/script>
okay
.
<script type="text/javascript">
// JavaScript example

document.getElementById("demo").innerHTML = "Hello JavaScript!";
<\/script>
<p>okay</p>
\`\`\`

A style tag (type 1):

\`\`\`example
<style
  type="text/css">
h1 {color:red;}

p {color:blue;}
</style>
okay
.
<style
  type="text/css">
h1 {color:red;}

p {color:blue;}
</style>
<p>okay</p>
\`\`\`

If there is no matching end tag, the block will end at the
end of the document (or the enclosing [block quote][block quotes]
or [list item][list items]):

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

The end tag can occur on the same line as the start tag:

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

请注意，在最后一行上
end tag will be included in the [HTML block]:

\`\`\`example
<script>
foo
<\/script>1. *bar*
.
<script>
foo
<\/script>1. *bar*
\`\`\`

A comment (type 2):

\`\`\`example
<!-- Foo

bar
   baz -->
okay
.
<!-- Foo

bar
   baz -->
<p>okay</p>
\`\`\`

A processing instruction (type 3):

\`\`\`example
<?php

  echo '>';

?>
okay
.
<?php

  echo '>';

?>
<p>okay</p>
\`\`\`

A declaration (type 4):

\`\`\`example
<!DOCTYPE html>
.
<!DOCTYPE html>
\`\`\`

CDATA (type 5):

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
okay
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
<p>okay</p>
\`\`\`

The opening tag can be indented 1-3 spaces, but not 4:

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

An HTML block of types 1--6 can interrupt a paragraph, and need not be
preceded by a blank line.

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

但是，需要有后续的空行，除非在
a document, and except for blocks of types 1--5, [above][HTML block]:

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

HTML blocks of type 7 cannot interrupt a paragraph:

\`\`\`example
Foo
<a href="bar">
baz
.
<p>Foo
<a href="bar">
baz</p>
\`\`\`

This rule differs from John Gruber's original Markdown syntax
specification, which says:

> The only restrictions are that block-level HTML elements —
> e.g. \`<div>\`, \`<table>\`, \`<pre>\`, \`<p>\`, etc. — must be separated from
> surrounding content by blank lines, and the start and end tags of the
> block should not be indented with tabs or spaces.

In some ways Gruber's rule is more restrictive than the one given
here:

- It requires that an HTML block be preceded by a blank line.
- It does not allow the start tag to be indented.
- It requires a matching end tag, which it also does not allow to
  be indented.

Most Markdown implementations (including some of Gruber's own) do not
respect all of these restrictions.

There is one respect, however, in which Gruber's rule is more liberal
than the one given here, since it allows blank lines to occur inside
an HTML block. There are two reasons for disallowing them here.
First, it removes the need to parse balanced tags, which is
expensive and can require backtracking from the end of the document
if no matching end tag is found. Second, it provides a very simple
and flexible way of including Markdown content inside HTML tags:
simply separate the Markdown from the HTML using blank lines:

Compare:

\`\`\`example
<div>

*Emphasized* text.

</div>
.
<div>
<p><em>Emphasized</em> text.</p>
</div>
\`\`\`

\`\`\`example
<div>
*Emphasized* text.
</div>
.
<div>
*Emphasized* text.
</div>
\`\`\`

Some Markdown implementations have adopted a convention of
interpreting content inside tags as text if the open tag has
the attribute \`markdown=1\`. The rule given above seems a simpler and
more elegant way of achieving the same expressive power, which is also
much simpler to parse.

The main potential drawback is that one can no longer paste HTML
blocks into Markdown documents with 100% reliability. However,
_in most cases_ this will work fine, because the blank lines in
HTML are usually followed by HTML block tags. For example:

\`\`\`example
<table>

<tr>

<td>
Hi
</td>

</tr>

</table>
.
<table>
<tr>
<td>
Hi
</td>
</tr>
</table>
\`\`\`

There are problems, however, if the inner tags are indented
_and_ separated by spaces, as then they will be interpreted as
an indented code block:

\`\`\`example
<table>

  <tr>

    <td>
      Hi
    </td>

  </tr>

</table>
.
<table>
  <tr>
<pre><code>&lt;td&gt;
  Hi
&lt;/td&gt;
</code></pre>
  </tr>
</table>
\`\`\`

Fortunately, blank lines are usually not necessary and can be
deleted. The exception is inside \`<pre>\` tags, but as described
[above][HTML blocks], raw HTML blocks starting with \`<pre>\`
_can_ contain blank lines.

## Link reference definitions

A [link reference definition](@)
consists of a [link label], indented up to three spaces, followed
by a colon (\`:\`), optional [whitespace] (including up to one
[line ending]), a [link destination],
optional [whitespace] (including up to one
[line ending]), and an optional [link
title], which if it is present must be separated
from the [link destination] by [whitespace].
No further [non-whitespace characters] may occur on the line.

A [link reference definition]
does not correspond to a structural element of a document. Instead, it
defines a label which can be used in [reference links]
and reference-style [images] elsewhere in the document. [Link
reference definitions] can come either before or after the links that use
them.

\`\`\`example
[foo]: /url "title"

[foo]
.
<p><a href="/url" title="title">foo</a></p>
\`\`\`

\`\`\`example
   [foo]:
      /url
           'the title'

[foo]
.
<p><a href="/url" title="the title">foo</a></p>
\`\`\`

\`\`\`example
[Foo*bar\\]]:my_(url) 'title (with parens)'

[Foo*bar\\]]
.
<p><a href="my_(url)" title="title (with parens)">Foo*bar]</a></p>
\`\`\`

\`\`\`example
[Foo bar]:
<my url>
'title'

[Foo bar]
.
<p><a href="my%20url" title="title">Foo bar</a></p>
\`\`\`

The title may extend over multiple lines:

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
[foo]: /url 'title

with blank line'

[foo]
.
<p>[foo]: /url 'title</p>
<p>with blank line'</p>
<p>[foo]</p>
\`\`\`

The title may be omitted:

\`\`\`example
[foo]:
/url

[foo]
.
<p><a href="/url">foo</a></p>
\`\`\`

The link destination may not be omitted:

\`\`\`example
[foo]:

[foo]
.
<p>[foo]:</p>
<p>[foo]</p>
\`\`\`

但是，可以使用以下方式指定空的链接目标
angle brackets:

\`\`\`example
[foo]: <>

[foo]
.
<p><a href="">foo</a></p>
\`\`\`

The title must be separated from the link destination by
whitespace:

\`\`\`example
[foo]: <bar>(baz)

[foo]
.
<p>[foo]: <bar>(baz)</p>
<p>[foo]</p>
\`\`\`

Both title and destination can contain backslash escapes
and literal backslashes:

\`\`\`example
[foo]: /url\\bar\\*baz "foo\\"bar\\baz"

[foo]
.
<p><a href="/url%5Cbar*baz" title="foo&quot;bar\\baz">foo</a></p>
\`\`\`

A link can come before its corresponding definition:

\`\`\`example
[foo]

[foo]: url
.
<p><a href="url">foo</a></p>
\`\`\`

If there are several matching definitions, the first one takes
precedence:

\`\`\`example
[foo]

[foo]: first
[foo]: second
.
<p><a href="first">foo</a></p>
\`\`\`

As noted in the section on [Links], matching of labels is
case-insensitive (see [matches]).

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
It contributes nothing to the document.

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

这不是链接引用定义，因为有
[non-whitespace characters] after the title:

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
four spaces:

\`\`\`example
    [foo]: /url "title"

[foo]
.
<pre><code>[foo]: /url &quot;title&quot;
</code></pre>
<p>[foo]</p>
\`\`\`

这不是链接引用定义，因为它出现在
a code block:

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

A [link reference definition] cannot interrupt a paragraph.

\`\`\`example
Foo
[bar]: /baz

[bar]
.
<p>Foo
[bar]: /baz</p>
<p>[bar]</p>
\`\`\`

但是，它可以直接跟在其他块级元素后面，例如标题
and thematic breaks, and it need not be followed by a blank line.

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

Several [link reference definitions]
can occur one after another, without intervening blank lines.

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

[Link reference definitions] can occur
inside block containers, like lists and block quotations. They
affect the entire document, not just the container in which they
are defined:

\`\`\`example
[foo]

> [foo]: /url
.
<p><a href="/url">foo</a></p>
<blockquote>
</blockquote>
\`\`\`

Whether something is a [link reference definition] is
independent of whether the link reference it defines is
used in the document. Thus, for example, the following
document contains just a link reference definition, and
no visible content:

\`\`\`example
[foo]: /url
.
\`\`\`

## Paragraphs

A sequence of non-blank lines that cannot be interpreted as other
kinds of blocks forms a [paragraph](@).
The contents of the paragraph are the result of parsing the
paragraph's raw content as inlines. The paragraph's raw content
is formed by concatenating the lines and removing initial and final
[whitespace].

A simple example with two paragraphs:

\`\`\`example
aaa

bbb
.
<p>aaa</p>
<p>bbb</p>
\`\`\`

Paragraphs can contain multiple lines, but no blank lines:

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

Multiple blank lines between paragraph have no effect:

\`\`\`example
aaa


bbb
.
<p>aaa</p>
<p>bbb</p>
\`\`\`

Leading spaces are skipped:

\`\`\`example
  aaa
 bbb
.
<p>aaa
bbb</p>
\`\`\`

Lines after the first may be indented any amount, since indented
code blocks cannot interrupt paragraphs.

\`\`\`example
aaa
             bbb
                                       ccc
.
<p>aaa
bbb
ccc</p>
\`\`\`

However, the first line may be indented at most three spaces,
or an indented code block will be triggered:

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

Final spaces are stripped before inline parsing, so a paragraph
that ends with two or more spaces will not end with a [hard line
break]:

\`\`\`example
aaa
bbb
.
<p>aaa<br />
bbb</p>
\`\`\`

## Blank lines

[Blank lines] between block-level elements are ignored,
except for the role they play in determining whether a [list]
is [tight] or [loose].

Blank lines at the beginning and end of the document are also ignored.

\`\`\`example


aaa


# aaa


.
<p>aaa</p>
<h1>aaa</h1>
\`\`\`

<div class="extension">

## Tables (extension)

GFM enables the \`table\` extension, where an additional leaf block type is
available.

A [table](@) is an arrangement of data with rows and columns, consisting of a
single header row, a [delimiter row] separating the header from the data, and
zero or more data rows.

Each row consists of cells containing arbitrary text, in which [inlines] are
parsed, separated by pipes (\`|\`). A leading and trailing pipe is also
recommended for clarity of reading, and if there's otherwise parsing ambiguity.
Spaces between pipes and cell content are trimmed. Block-level elements cannot
be inserted in a table.

The [delimiter row](@) consists of cells whose only content are hyphens (\`-\`),
and optionally, a leading or trailing colon (\`:\`), or both, to indicate left,
right, or center alignment respectively.

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

Cells in one column don't need to match length, though it's easier to read if
they are. Likewise, use of leading and trailing pipes may be inconsistent:

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

Include a pipe in a cell's content by escaping it, including inside other
inline spans:

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

The table is broken at the first empty line, or beginning of another
block-level structure:

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

The header row must match the [delimiter row] in the number of cells. If not,
a table will not be recognized:

\`\`\`example table
| abc | def |
| --- |
| bar |
.
<p>| abc | def |
| --- |
| bar |</p>
\`\`\`

The remainder of the table's rows may vary in the number of cells. If there
are a number of cells fewer than the number of cells in the header row, empty
cells are inserted. If there are greater, the excess is ignored:

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

If there are no rows in the body, no \`<tbody>\` is generated in HTML output:

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

# Container blocks

A [container block](#container-blocks) is a block that has other
blocks as its contents. There are two basic kinds of container blocks:
[block quotes] and [list items].
[Lists] are meta-containers for [list items].

We define the syntax for container blocks recursively. The general
form of the definition is:

> If X is a sequence of blocks, then the result of
> transforming X in such-and-such a way is a container of type Y
> with these blocks as its content.

So, we explain what counts as a block quote or list item by explaining
how these can be _generated_ from their contents. This should suffice
to define the syntax, although it does not give a recipe for _parsing_
these constructions. (A recipe is provided below in the section entitled
[A parsing strategy](#appendix-a-parsing-strategy).)

## Block quotes

A [block quote marker](@)
consists of 0-3 spaces of initial indent, plus (a) the character \`>\` together
with a following space, or (b) a single character \`>\` not followed by a space.

The following rules define [block quotes]:

1.  **Basic case.** If a string of lines _Ls_ constitute a sequence
    of blocks _Bs_, then the result of prepending a [block quote
    marker] to the beginning of each line in _Ls_
    is a [block quote](#block-quotes) containing _Bs_.

2.  **Laziness.** If a string of lines _Ls_ constitute a [block
    quote](#block-quotes) with contents _Bs_, then the result of deleting
    the initial [block quote marker] from one or
    more lines in which the next [non-whitespace character] after the [block
    quote marker] is [paragraph continuation
    text] is a block quote with _Bs_ as its content.
    [Paragraph continuation text](@) is text
    that will be parsed as part of the content of a paragraph, but does
    not occur at the beginning of the paragraph.

3.  **Consecutiveness.** A document cannot contain two [block
    quotes] in a row unless there is a [blank line] between them.

Nothing else counts as a [block quote](#block-quotes).

Here is a simple example:

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

The spaces after the \`>\` characters can be omitted:

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

The \`>\` characters can be indented 1-3 spaces:

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

The Laziness clause allows us to omit the \`>\` before
[paragraph continuation text]:

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

A block quote can contain some lazy and some non-lazy
continuation lines:

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

Laziness only applies to lines that would have been continuations of
paragraphs had they been prepended with [block quote markers].
For example, the \`> \` cannot be omitted in the second line of

\`\`\`markdown
> ## foo
\`\`\`

without changing the meaning:

\`\`\`example
> foo
---
.
<blockquote>
<p>foo</p>
</blockquote>
<hr />
\`\`\`

Similarly, if we omit the \`> \` in the second line of

\`\`\`markdown
> - foo
> - bar
\`\`\`

then the block quote ends after the first line:

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

For the same reason, we can't omit the \`> \` in front of
subsequent lines of an indented or fenced code block:

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

Note that in the following case, we have a [lazy
continuation line]:

\`\`\`example
> foo
    - bar
.
<blockquote>
<p>foo
- bar</p>
</blockquote>
\`\`\`

To see why, note that in

\`\`\`markdown
> foo - bar
\`\`\`

the \`- bar\` is indented too far to start a list, and can't
be an indented code block because indented code blocks cannot
interrupt paragraphs, so it is [paragraph continuation text].

A block quote can be empty:

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

A block quote can have initial or final blank lines:

\`\`\`example
>
> foo
>
.
<blockquote>
<p>foo</p>
</blockquote>
\`\`\`

A blank line always separates block quotes:

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

(Most current Markdown implementations, including John Gruber's
original \`Markdown.pl\`, will parse this example as a single block quote
with two paragraphs. But it seems better to allow the author to decide
whether two block quotes or one are wanted.)

Consecutiveness means that if we put these block quotes together,
we get a single block quote:

\`\`\`example
> foo
> bar
.
<blockquote>
<p>foo
bar</p>
</blockquote>
\`\`\`

To get a block quote with two paragraphs, use:

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

Block quotes can interrupt paragraphs:

\`\`\`example
foo
> bar
.
<p>foo</p>
<blockquote>
<p>bar</p>
</blockquote>
\`\`\`

In general, blank lines are not needed before or after block
quotes:

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

However, because of laziness, a blank line is needed between
a block quote and a following paragraph:

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

It is a consequence of the Laziness rule that any number
of initial \`>\`s may be omitted on a continuation line of a
nested block quote:

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

When including an indented code block in a block quote,
remember that the [block quote marker] includes
both the \`>\` and a following space. So _five spaces_ are needed after
the \`>\`:

\`\`\`example
>     code

>    not code
.
<blockquote>
<pre><code>code
</code></pre>
</blockquote>
<blockquote>
<p>not code</p>
</blockquote>
\`\`\`

## List items

A [list marker](@) is a
[bullet list marker] or an [ordered list marker].

A [bullet list marker](@)
is a \`-\`, \`+\`, or \`*\` character.

An [ordered list marker](@)
is a sequence of 1--9 arabic digits (\`0-9\`), followed by either a
\`.\` character or a \`)\` character. (The reason for the length
limit is that with 10 digits we start seeing integer overflows
in some browsers.)

The following rules define [list items]:

1.  **Basic case.** If a sequence of lines _Ls_ constitute a sequence of
    blocks _Bs_ starting with a [non-whitespace character], and _M_ is a
    list marker of width _W_ followed by 1 ≤ _N_ ≤ 4 spaces, then the result
    of prepending _M_ and the following spaces to the first line of
    _Ls_, and indenting subsequent lines of _Ls_ by _W + N_ spaces, is a
    list item with _Bs_ as its contents. The type of the list item
    (bullet or ordered) is determined by the type of its list marker.
    If the list item is ordered, then it is also assigned a start
    number, based on the ordered list marker.

    Exceptions:
    1. When the first list item in a [list] interrupts
       a paragraph---that is, when it starts on a line that would
       otherwise count as [paragraph continuation text]---then (a)
       the lines _Ls_ must not begin with a blank line, and (b) if
       the list item is ordered, the start number must be 1.
    2. If any line is a [thematic break][thematic breaks] then
       that line is not a list item.

For example, let _Ls_ be the lines

\`\`\`example
A paragraph
with two lines.

    indented code

> A block quote.
.
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
\`\`\`

And let _M_ be the marker \`1.\`, and _N_ = 2. Then rule #1 says
that the following is an ordered list item with start number 1,
and the same contents as _Ls_:

\`\`\`example
1.  A paragraph
    with two lines.

        indented code

    > A block quote.
.
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>
\`\`\`

The most important thing to notice is that the position of
the text after the list marker determines how much indentation
is needed in subsequent blocks in the list item. If the list
marker takes up two spaces, and there are three spaces between
the list marker and the next [non-whitespace character], then blocks
must be indented five spaces in order to fall under the list
item.

Here are some examples showing how far content must be indented to be
put under the list item:

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

It is tempting to think of this in terms of columns: the continuation
blocks must be indented at least to the column of the first
[non-whitespace character] after the list marker. However, that is not quite right.
The spaces after the list marker determine how much relative indentation
is needed. Which column this indentation reaches will depend on
how the list item is embedded in other constructions, as shown by
this example:

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

Here \`two\` occurs in the same column as the list marker \`1.\`,
but is actually contained in the list item, because there is
sufficient indentation after the last containing blockquote marker.

The converse is also possible. In the following example, the word \`two\`
occurs far to the right of the initial text of the list item, \`one\`, but
it is not considered part of the list item, because it is not indented
far enough past the blockquote marker:

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

Note that at least one space is needed between the list marker and
any following content, so these are not list items:

\`\`\`example
-one

2.two
.
<p>-one</p>
<p>2.two</p>
\`\`\`

A list item may contain blocks that are separated by more than
one blank line.

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

A list item may contain any kind of block:

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

A list item that contains an indented code block will preserve
empty lines within the code block verbatim.

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

Note that ordered list start numbers must be nine digits or less:

\`\`\`example
123456789. ok
.
<ol start="123456789">
<li>ok</li>
</ol>
\`\`\`

\`\`\`example
1234567890. not ok
.
<p>1234567890. not ok</p>
\`\`\`

A start number may begin with 0s:

\`\`\`example
0. ok
.
<ol start="0">
<li>ok</li>
</ol>
\`\`\`

\`\`\`example
003. ok
.
<ol start="3">
<li>ok</li>
</ol>
\`\`\`

A start number may not be negative:

\`\`\`example
-1. not ok
.
<p>-1. not ok</p>
\`\`\`

2.  **Item starting with indented code.** If a sequence of lines _Ls_
    constitute a sequence of blocks _Bs_ starting with an indented code
    block, and _M_ is a list marker of width _W_ followed by
    one space, then the result of prepending _M_ and the following
    space to the first line of _Ls_, and indenting subsequent lines of
    _Ls_ by _W + 1_ spaces, is a list item with _Bs_ as its contents.
    If a line is empty, then it need not be indented. The type of the
    list item (bullet or ordered) is determined by the type of its list
    marker. If the list item is ordered, then it is also assigned a
    start number, based on the ordered list marker.

An indented code block will have to be indented four spaces beyond
the edge of the region where text will be included in the list item.
In the following case that is 6 spaces:

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

And in this case it is 11 spaces:

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

If the _first_ block in the list item is an indented code block,
then by rule #2, the contents must be indented _one_ space after the
list marker:

\`\`\`example
    indented code

paragraph

    more code
.
<pre><code>indented code
</code></pre>
<p>paragraph</p>
<pre><code>more code
</code></pre>
\`\`\`

\`\`\`example
1.     indented code

   paragraph

       more code
.
<ol>
<li>
<pre><code>indented code
</code></pre>
<p>paragraph</p>
<pre><code>more code
</code></pre>
</li>
</ol>
\`\`\`

Note that an additional space indent is interpreted as space
inside the code block:

\`\`\`example
1.      indented code

   paragraph

       more code
.
<ol>
<li>
<pre><code> indented code
</code></pre>
<p>paragraph</p>
<pre><code>more code
</code></pre>
</li>
</ol>
\`\`\`

Note that rules #1 and #2 only apply to two cases: (a) cases
in which the lines to be included in a list item begin with a
[non-whitespace character], and (b) cases in which
they begin with an indented code
block. In a case like the following, where the first block begins with
a three-space indent, the rules do not allow us to form a list item by
indenting the whole thing and prepending a list marker:

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

This is not a significant restriction, because when a block begins
with 1-3 spaces indent, the indentation can always be removed without
a change in interpretation, allowing rule #1 to be applied. So, in
the above case:

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

3.  **Item starting with a blank line.** If a sequence of lines _Ls_
    starting with a single [blank line] constitute a (possibly empty)
    sequence of blocks _Bs_, not separated from each other by more than
    one blank line, and _M_ is a list marker of width _W_,
    then the result of prepending _M_ to the first line of _Ls_, and
    indenting subsequent lines of _Ls_ by _W + 1_ spaces, is a list
    item with _Bs_ as its contents.
    If a line is empty, then it need not be indented. The type of the
    list item (bullet or ordered) is determined by the type of its list
    marker. If the list item is ordered, then it is also assigned a
    start number, based on the ordered list marker.

Here are some list items that start with a blank line but are not empty:

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

When the list item starts with a blank line, the number of spaces
following the list marker doesn't change the required indentation:

\`\`\`example
-
  foo
.
<ul>
<li>foo</li>
</ul>
\`\`\`

A list item can begin with at most one blank line.
In the following example, \`foo\` is not part of the list
item:

\`\`\`example
-

  foo
.
<ul>
<li></li>
</ul>
<p>foo</p>
\`\`\`

Here is an empty bullet list item:

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

It does not matter whether there are spaces following the [list marker]:

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

Here is an empty ordered list item:

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

A list may start or end with an empty list item:

\`\`\`example
*
.
<ul>
<li></li>
</ul>
\`\`\`

However, an empty list item cannot interrupt a paragraph:

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

4.  **Indentation.** If a sequence of lines _Ls_ constitutes a list item
    according to rule #1, #2, or #3, then the result of indenting each line
    of _Ls_ by 1-3 spaces (the same for each line) also constitutes a
    list item with the same contents and attributes. If a line is
    empty, then it need not be indented.

缩进一个空格：

\`\`\`example
 1.  A paragraph
     with two lines.

         indented code

     > A block quote.
.
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>
\`\`\`

缩进两个空格：

\`\`\`example
  1.  A paragraph
      with two lines.

          indented code

      > A block quote.
.
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>
\`\`\`

缩进三个空格：

\`\`\`example
   1.  A paragraph
       with two lines.

           indented code

       > A block quote.
.
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>
\`\`\`

Four spaces indent gives a code block:

\`\`\`example
    1.  A paragraph
        with two lines.

            indented code

        > A block quote.
.
<pre><code>1.  A paragraph
    with two lines.

        indented code

    &gt; A block quote.
</code></pre>
\`\`\`

5.  **Laziness.** If a string of lines _Ls_ constitute a [list
    item](#list-items) with contents _Bs_, then the result of deleting
    some or all of the indentation from one or more lines in which the
    next [non-whitespace character] after the indentation is
    [paragraph continuation text] is a
    list item with the same contents and attributes. The unindented
    lines are called
    [lazy continuation line](@)s.

Here is an example with [lazy continuation lines]:

\`\`\`example
  1.  A paragraph
with two lines.

          indented code

      > A block quote.
.
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>
\`\`\`

Indentation can be partially deleted:

\`\`\`example
  1.  A paragraph
    with two lines.
.
<ol>
<li>A paragraph
with two lines.</li>
</ol>
\`\`\`

These examples show how laziness can work in nested structures:

\`\`\`example
> 1. > Blockquote
continued here.
.
<blockquote>
<ol>
<li>
<blockquote>
<p>Blockquote
continued here.</p>
</blockquote>
</li>
</ol>
</blockquote>
\`\`\`

\`\`\`example
> 1. > Blockquote
> continued here.
.
<blockquote>
<ol>
<li>
<blockquote>
<p>Blockquote
continued here.</p>
</blockquote>
</li>
</ol>
</blockquote>
\`\`\`

6.  **That's all.** Nothing that is not counted as a list item by rules
    #1--5 counts as a [list item](#list-items).

The rules for sublists follow from the general rules
[above][List items]. A sublist must be indented the same number
of spaces a paragraph would need to be in order to be included
in the list item.

So, in this case we need two spaces indent:

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

One is not enough:

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

Here we need four, because the list marker is wider:

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

Three is not enough:

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

A list may be the first block in a list item:

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

A list item can contain a heading:

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

### Motivation

John Gruber's Markdown spec says the following about list items:

1. "List markers typically start at the left margin, but may be indented
   by up to three spaces. List markers must be followed by one or more
   spaces or a tab."

2. "To make lists look nice, you can wrap items with hanging indents....
   But if you don't want to, you don't have to."

3. "List items may consist of multiple paragraphs. Each subsequent
   paragraph in a list item must be indented by either 4 spaces or one
   tab."

4. "It looks nice if you indent every line of the subsequent paragraphs,
   but here again, Markdown will allow you to be lazy."

5. "To put a blockquote within a list item, the blockquote's \`>\`
   delimiters need to be indented."

6. "To put a code block within a list item, the code block needs to be
   indented twice — 8 spaces or two tabs."

These rules specify that a paragraph under a list item must be indented
four spaces (presumably, from the left margin, rather than the start of
the list marker, but this is not said), and that code under a list item
must be indented eight spaces instead of the usual four. They also say
that a block quote must be indented, but not by how much; however, the
example given has four spaces indentation. Although nothing is said
about other kinds of block-level content, it is certainly reasonable to
infer that _all_ block elements under a list item, including other
lists, must be indented four spaces. This principle has been called the
_four-space rule_.

The four-space rule is clear and principled, and if the reference
implementation \`Markdown.pl\` had followed it, it probably would have
become the standard. However, \`Markdown.pl\` allowed paragraphs and
sublists to start with only two spaces indentation, at least on the
outer level. Worse, its behavior was inconsistent: a sublist of an
outer-level list needed two spaces indentation, but a sublist of this
sublist needed three spaces. It is not surprising, then, that different
implementations of Markdown have developed very different rules for
determining what comes under a list item. (Pandoc and python-Markdown,
for example, stuck with Gruber's syntax description and the four-space
rule, while discount, redcarpet, marked, PHP Markdown, and others
followed \`Markdown.pl\`'s behavior more closely.)

Unfortunately, given the divergences between implementations, there
is no way to give a spec for list items that will be guaranteed not
to break any existing documents. However, the spec given here should
correctly handle lists formatted with either the four-space rule or
the more forgiving \`Markdown.pl\` behavior, provided they are laid out
in a way that is natural for a human to read.

The strategy here is to let the width and indentation of the list marker
determine the indentation necessary for blocks to fall under the list
item, rather than having a fixed and arbitrary number. The writer can
think of the body of the list item as a unit which gets indented to the
right enough to fit the list marker (and any indentation on the list
marker). (The laziness rule, #5, then allows continuation lines to be
unindented if needed.)

This rule is superior, we claim, to any rule requiring a fixed level of
indentation from the margin. The four-space rule is clear but
unnatural. It is quite unintuitive that

\`\`\`markdown
- foo

  bar
  - baz
\`\`\`

should be parsed as two lists with an intervening paragraph,

\`\`\`html
<ul>
  <li>foo</li>
</ul>
<p>bar</p>
<ul>
  <li>baz</li>
</ul>
\`\`\`

as the four-space rule demands, rather than a single list,

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

The choice of four spaces is arbitrary. It can be learned, but it is
not likely to be guessed, and it trips up beginners regularly.

Would it help to adopt a two-space rule? The problem is that such
a rule, together with the rule allowing 1--3 spaces indentation of the
initial list marker, allows text that is indented _less than_ the
original list marker to be included in the list item. For example,
\`Markdown.pl\` parses

\`\`\`markdown
- one

two
\`\`\`

as a single list item, with \`two\` a continuation paragraph:

\`\`\`html
<ul>
  <li>
    <p>one</p>
    <p>two</p>
  </li>
</ul>
\`\`\`

and similarly

\`\`\`markdown
> - one
>
> two
\`\`\`

as

\`\`\`html
<blockquote>
  <ul>
    <li>
      <p>one</p>
      <p>two</p>
    </li>
  </ul>
</blockquote>
\`\`\`

This is extremely unintuitive.

Rather than requiring a fixed indent from the margin, we could require
a fixed indent (say, two spaces, or even one space) from the list marker (which
may itself be indented). This proposal would remove the last anomaly
discussed. Unlike the spec presented above, it would count the following
as a list item with a subparagraph, even though the paragraph \`bar\`
is not indented as far as the first paragraph \`foo\`:

\`\`\`markdown
10. foo

bar
\`\`\`

Arguably this text does read like a list item with \`bar\` as a subparagraph,
which may count in favor of the proposal. However, on this proposal indented
code would have to be indented six spaces after the list marker. And this
would break a lot of existing Markdown, which has the pattern:

\`\`\`markdown
1.  foo

        indented code
\`\`\`

where the code is indented eight spaces. The spec above, by contrast, will
parse this text as expected, since the code block's indentation is measured
from the beginning of \`foo\`.

The one case that needs special treatment is a list item that _starts_
with indented code. How much indentation is required in that case, since
we don't have a "first paragraph" to measure from? Rule #2 simply stipulates
that in such cases, we require one space indentation from the list marker
(and then the normal four spaces for the indented code). This will match the
four-space rule in cases where the list marker plus its initial indentation
takes four spaces (a common case), but diverge in other cases.

<div class="extension">

## Task list items (extension)

GFM enables the \`tasklist\` extension, where an additional processing step is
performed on [list items].

A [task list item](@) is a [list item][list items] where the first block in it
is a paragraph which begins with a [task list item marker] and at least one
whitespace character before any other content.

A [task list item marker](@) consists of an optional number of spaces, a left
bracket (\`[\`), either a whitespace character or the letter \`x\` in either
lowercase or uppercase, and then a right bracket (\`]\`).

When rendered, the [task list item marker] is replaced with a semantic checkbox element;
in an HTML output, this would be an \`<input type="checkbox">\` element.

If the character between the brackets is a whitespace character, the checkbox
is unchecked. Otherwise, the checkbox is checked.

This spec does not define how the checkbox elements are interacted with: in practice,
implementors are free to render the checkboxes as disabled or inmutable elements,
or they may dynamically handle dynamic interactions (i.e. checking, unchecking) in
the final rendered document.

\`\`\`example disabled
- [ ] foo
- [x] bar
.
<ul>
<li><input disabled="" type="checkbox"> foo</li>
<li><input checked="" disabled="" type="checkbox"> bar</li>
</ul>
\`\`\`

Task lists can be arbitrarily nested:

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

## Lists

A [list](@) is a sequence of one or more
list items [of the same type]. The list items
may be separated by any number of blank lines.

Two list items are [of the same type](@)
if they begin with a [list marker] of the same type.
Two list markers are of the
same type if (a) they are bullet list markers using the same character
(\`-\`, \`+\`, or \`*\`) or (b) they are ordered list numbers with the same
delimiter (either \`.\` or \`)\`).

A list is an [ordered list](@)
if its constituent list items begin with
[ordered list markers], and a
[bullet list](@) if its constituent list
items begin with [bullet list markers].

The [start number](@)
of an [ordered list] is determined by the list number of
its initial list item. The numbers of subsequent list items are
disregarded.

A list is [loose](@) if any of its constituent
list items are separated by blank lines, or if any of its constituent
list items directly contain two block-level elements with a blank line
between them. Otherwise a list is [tight](@).
(The difference in HTML output is that paragraphs in a loose list are
wrapped in \`<p>\` tags, while paragraphs in a tight list are not.)

Changing the bullet or ordered list delimiter starts a new list:

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

In CommonMark, a list can interrupt a paragraph. That is,
no blank line is needed to separate a paragraph from a following
list:

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

\`Markdown.pl\` does not allow this, through fear of triggering a list
via a numeral in a hard-wrapped line:

\`\`\`markdown
The number of windows in my house is 14. The number of doors is 6.
\`\`\`

Oddly, though, \`Markdown.pl\` _does_ allow a blockquote to
interrupt a paragraph, even though the same considerations might
apply.

In CommonMark, we do allow lists to interrupt paragraphs, for
two reasons. First, it is natural and not uncommon for people
to start lists without blank lines:

\`\`\`markdown
I need to buy

- new shoes
- a coat
- a plane ticket
\`\`\`

Second, we are attracted to a

> [principle of uniformity](@):
> if a chunk of text has a certain
> meaning, it will continue to have the same meaning when put into a
> container block (such as a list item or blockquote).

(Indeed, the spec for [list items] and [block quotes] presupposes
this principle.) This principle implies that if

\`\`\`markdown
- I need to buy
  - new shoes
  - a coat
  - a plane ticket
\`\`\`

is a list item containing a paragraph followed by a nested sublist,
as all Markdown implementations agree it is (though the paragraph
may be rendered without \`<p>\` tags, since the list is "tight"),
then

\`\`\`markdown
I need to buy

- new shoes
- a coat
- a plane ticket
\`\`\`

by itself should be a paragraph followed by a nested sublist.

Since it is well established Markdown practice to allow lists to
interrupt paragraphs inside list items, the [principle of
uniformity] requires us to allow this outside list items as
well. ([reStructuredText](http://docutils.sourceforge.net/rst.html)
takes a different approach, requiring blank lines before lists
even inside other list items.)

In order to solve the problem of unwanted lists in paragraphs with
hard-wrapped numerals, we allow only lists starting with \`1\` to
interrupt paragraphs. Thus,

\`\`\`example
The number of windows in my house is
14.  The number of doors is 6.
.
<p>The number of windows in my house is
14.  The number of doors is 6.</p>
\`\`\`

We may still get an unintended result in cases like

\`\`\`example
The number of windows in my house is
1.  The number of doors is 6.
.
<p>The number of windows in my house is</p>
<ol>
<li>The number of doors is 6.</li>
</ol>
\`\`\`

but this rule should prevent most spurious list captures.

There can be any number of blank lines between items:

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

To separate consecutive lists of the same type, or to separate a
list from an indented code block that would otherwise be parsed
as a subparagraph of the final list item, you can insert a blank HTML
comment:

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

    notcode

-   foo

<!-- -->

    code
.
<ul>
<li>
<p>foo</p>
<p>notcode</p>
</li>
<li>
<p>foo</p>
</li>
</ul>
<!-- -->
<pre><code>code
</code></pre>
\`\`\`

List items need not be indented to the same level. The following
list items will be treated as items at the same list level,
since none is indented enough to belong to the previous list
item:

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

Note, however, that list items may not be indented more than
three spaces. Here \`- e\` is treated as a paragraph continuation
line, because it is indented more than three spaces:

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

And here, \`3. c\` is treated as in indented code block,
because it is indented four spaces and preceded by a
blank line.

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

This is a loose list, because there is a blank line between
two of the list items:

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

So is this, with a empty second item:

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

These are loose lists, even though there is no space between the items,
because one of the items directly contains two block-level elements
with a blank line between them:

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

This is a tight list, because the blank lines are in a code block:

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

This is a tight list, because the blank line is between two
paragraphs of a sublist. So the sublist is loose while
the outer list is tight:

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

This is a tight list, because the blank line is inside the
block quote:

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

This list is tight, because the consecutive block elements
are not separated by blank lines:

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

A single-paragraph list is tight:

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

This list is loose, because of the blank line between the
two block elements in the list item:

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

Here the outer list is loose, the inner list tight:

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

# Inlines

Inlines are parsed sequentially from the beginning of the character
stream to the end (left to right, in left-to-right languages).
Thus, for example, in

\`\`\`example
\`hi\`lo\`
.
<p><code>hi</code>lo\`</p>
\`\`\`

\`hi\` is parsed as code, leaving the backtick at the end as a literal
backtick.

## Backslash escapes

Any ASCII punctuation character may be backslash-escaped:

\`\`\`example
\\!\\"\\#\\$\\%\\&\\'\\(\\)\\*\\+\\,\\-\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\\\\\]\\^\\_\\\`\\{\\|\\}\\~
.
<p>!&quot;#$%&amp;'()*+,-./:;&lt;=&gt;?@[\\]^_\`{|}~</p>
\`\`\`

Backslashes before other characters are treated as literal
backslashes:

\`\`\`example
\\→\\A\\a\\ \\3\\φ\\«
.
<p>\\→\\A\\a\\ \\3\\φ\\«</p>
\`\`\`

Escaped characters are treated as regular characters and do
not have their usual Markdown meanings:

\`\`\`example
\\*not emphasized*
\\<br/> not a tag
\\[not a link](/foo)
\\\`not code\`
1\\. not a list
\\* not a list
\\# not a heading
\\[foo]: /url "not a reference"
\\&ouml; not a character entity
.
<p>*not emphasized*
&lt;br/&gt; not a tag
[not a link](/foo)
\`not code\`
1. not a list
* not a list
# not a heading
[foo]: /url &quot;not a reference&quot;
&amp;ouml; not a character entity</p>
\`\`\`

If a backslash is itself escaped, the following character is not:

\`\`\`example
\\\\*emphasis*
.
<p>\\<em>emphasis</em></p>
\`\`\`

A backslash at the end of the line is a [hard line break]:

\`\`\`example
foo\\
bar
.
<p>foo<br />
bar</p>
\`\`\`

Backslash escapes do not work in code blocks, code spans, autolinks, or
raw HTML:

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

But they work in all other contexts, including URLs and link titles,
link references, and [info strings] in [fenced code blocks]:

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

## Entity and numeric character references

Valid HTML entity references and numeric character references
can be used in place of the corresponding Unicode character,
with the following exceptions:

- Entity and character references are not recognized in code
  blocks and code spans.

- Entity and character references cannot stand in place of
  special characters that define structural elements in
  CommonMark. For example, although \`&#42;\` can be used
  in place of a literal \`*\` character, \`&#42;\` cannot replace
  \`*\` in emphasis delimiters, bullet list markers, or thematic
  breaks.

Conforming CommonMark parsers need not store information about
whether a particular character was represented in the source
using a Unicode character or an entity reference.

[Entity references](@) consist of \`&\` + any of the valid
HTML5 entity names + \`;\`. The
document <https://html.spec.whatwg.org/multipage/entities.json>
is used as an authoritative source for the valid entity
references and their corresponding code points.

\`\`\`example
&nbsp; &amp; &copy; &AElig; &Dcaron;
&frac34; &HilbertSpace; &DifferentialD;
&ClockwiseContourIntegral; &ngE;
.
<p>  &amp; © Æ Ď
¾ ℋ ⅆ
∲ ≧̸</p>
\`\`\`

[Decimal numeric character
references](@)
consist of \`&#\` + a string of 1--7 arabic digits + \`;\`. A
numeric character reference is parsed as the corresponding
Unicode character. Invalid Unicode code points will be replaced by
the REPLACEMENT CHARACTER (\`U+FFFD\`). For security reasons,
the code point \`U+0000\` will also be replaced by \`U+FFFD\`.

\`\`\`example
&#35; &#1234; &#992; &#0;
.
<p># Ӓ Ϡ �</p>
\`\`\`

[Hexadecimal numeric character
references](@) consist of \`&#\` +
either \`X\` or \`x\` + a string of 1-6 hexadecimal digits + \`;\`.
They too are parsed as the corresponding Unicode character (this
time specified with a hexadecimal numeral instead of decimal).

\`\`\`example
&#X22; &#XD06; &#xcab;
.
<p>&quot; ആ ಫ</p>
\`\`\`

Here are some nonentities:

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

Although HTML5 does accept some entity references
without a trailing semicolon (such as \`&copy\`), these are not
recognized here, because it makes the grammar too ambiguous:

\`\`\`example
&copy
.
<p>&amp;copy</p>
\`\`\`

Strings that are not on the list of HTML5 named entities are not
recognized as entity references either:

\`\`\`example
&MadeUpEntity;
.
<p>&amp;MadeUpEntity;</p>
\`\`\`

Entity and numeric character references are recognized in any
context besides code spans or code blocks, including
URLs, [link titles], and [fenced code block][] [info strings]:

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

Entity and numeric character references are treated as literal
text in code spans and code blocks:

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

Entity and numeric character references cannot be used
in place of symbols indicating structure in CommonMark
documents.

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

## Code spans

A [backtick string](@)
is a string of one or more backtick characters (\`\` \` \`\`) that is neither
preceded nor followed by a backtick.

A [code span](@) begins with a backtick string and ends with
a backtick string of equal length. The contents of the code span are
the characters between the two backtick strings, normalized in the
following ways:

- First, [line endings] are converted to [spaces].
- If the resulting string both begins _and_ ends with a [space]
  character, but does not consist entirely of [space]
  characters, a single [space] character is removed from the
  front and back. This allows you to include code that begins
  or ends with backtick characters, which must be separated by
  whitespace from the opening or closing backtick strings.

This is a simple code span:

\`\`\`example
\`foo\`
.
<p><code>foo</code></p>
\`\`\`

Here two backticks are used, because the code contains a backtick.
This example also illustrates stripping of a single leading and
trailing space:

\`\`\`example
\`\` foo \` bar \`\`
.
<p><code>foo \` bar</code></p>
\`\`\`

This example shows the motivation for stripping leading and trailing
spaces:

\`\`\`example
\` \`\` \`
.
<p><code>\`\`</code></p>
\`\`\`

Note that only _one_ space is stripped:

\`\`\`example
\`  \`\`  \`
.
<p><code> \`\` </code></p>
\`\`\`

The stripping only happens if the space is on both
sides of the string:

\`\`\`example
\` a\`
.
<p><code> a</code></p>
\`\`\`

Only [spaces], and not [unicode whitespace] in general, are
stripped in this way:

\`\`\`example
\` b \`
.
<p><code> b </code></p>
\`\`\`

No stripping occurs if the code span contains only spaces:

\`\`\`example
\` \`
\`  \`
.
<p><code> </code>
<code>  </code></p>
\`\`\`

[Line endings] are treated like spaces:

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

Interior spaces are not collapsed:

\`\`\`example
\`foo   bar
baz\`
.
<p><code>foo   bar  baz</code></p>
\`\`\`

Note that browsers will typically collapse consecutive spaces
when rendering \`<code>\` elements, so it is recommended that
the following CSS be used:

    code{white-space: pre-wrap;}

Note that backslash escapes do not work in code spans. All backslashes
are treated literally:

\`\`\`example
\`foo\\\`bar\`
.
<p><code>foo\\</code>bar\`</p>
\`\`\`

Backslash escapes are never needed, because one can always choose a
string of _n_ backtick characters as delimiters, where the code does
not contain any strings of exactly _n_ backtick characters.

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

Code span backticks have higher precedence than any other inline
constructs except HTML tags and autolinks. Thus, for example, this is
not parsed as emphasized text, since the second \`*\` is part of a code
span:

\`\`\`example
*foo\`*\`
.
<p>*foo<code>*</code></p>
\`\`\`

And this is not parsed as a link:

\`\`\`example
[not a \`link](/foo\`)
.
<p>[not a <code>link](/foo</code>)</p>
\`\`\`

Code spans, HTML tags, and autolinks have the same precedence.
Thus, this is code:

\`\`\`example
\`<a href="\`">\`
.
<p><code>&lt;a href=&quot;</code>&quot;&gt;\`</p>
\`\`\`

But this is an HTML tag:

\`\`\`example
<a href="\`">\`
.
<p><a href="\`">\`</p>
\`\`\`

And this is code:

\`\`\`example
\`<http://foo.bar.\`baz>\`
.
<p><code>&lt;http://foo.bar.</code>baz&gt;\`</p>
\`\`\`

But this is an autolink:

\`\`\`example
<http://foo.bar.\`baz>\`
.
<p><a href="http://foo.bar.%60baz">http://foo.bar.\`baz</a>\`</p>
\`\`\`

When a backtick string is not closed by a matching backtick string,
we just have literal backticks:

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

The following case also illustrates the need for opening and
closing backtick strings to be equal in length:

\`\`\`example
\`foo\`\`bar\`\`
.
<p>\`foo<code>bar</code></p>
\`\`\`

## Emphasis and strong emphasis

John Gruber's original [Markdown syntax
description](http://daringfireball.net/projects/markdown/syntax#em) says:

> Markdown treats asterisks (\`*\`) and underscores (\`_\`) as indicators of
> emphasis. Text wrapped with one \`*\` or \`_\` will be wrapped with an HTML
> \`<em>\` tag; double \`*\`'s or \`_\`'s will be wrapped with an HTML \`<strong>\`
> tag.

This is enough for most users, but these rules leave much undecided,
especially when it comes to nested emphasis. The original
\`Markdown.pl\` test suite makes it clear that triple \`***\` and
\`___\` delimiters can be used for strong emphasis, and most
implementations have also allowed the following patterns:

\`\`\`markdown
**_strong emph_**
**\\*strong** in emph\\*
**_emph_ in strong**
**in strong _emph_**
\\*in emph **strong\\***
\`\`\`

The following patterns are less widely supported, but the intent
is clear and they are useful (especially in contexts like bibliography
entries):

\`\`\`markdown
*emph *with emph* in it*
**strong **with strong** in it**
\`\`\`

Many implementations have also restricted intraword emphasis to
the \`*\` forms, to avoid unwanted emphasis in words containing
internal underscores. (It is best practice to put these in code
spans, but users often do not.)

\`\`\`markdown
internal emphasis: foo*bar*baz
no emphasis: foo_bar_baz
\`\`\`

The rules given below capture all of these patterns, while allowing
for efficient parsing strategies that do not backtrack.

First, some definitions. A [delimiter run](@) is either
a sequence of one or more \`*\` characters that is not preceded or
followed by a non-backslash-escaped \`*\` character, or a sequence
of one or more \`_\` characters that is not preceded or followed by
a non-backslash-escaped \`_\` character.

A [left-flanking delimiter run](@) is
a [delimiter run] that is (1) not followed by [Unicode whitespace],
and either (2a) not followed by a [punctuation character], or
(2b) followed by a [punctuation character] and
preceded by [Unicode whitespace] or a [punctuation character].
For purposes of this definition, the beginning and the end of
the line count as Unicode whitespace.

A [right-flanking delimiter run](@) is
a [delimiter run] that is (1) not preceded by [Unicode whitespace],
and either (2a) not preceded by a [punctuation character], or
(2b) preceded by a [punctuation character] and
followed by [Unicode whitespace] or a [punctuation character].
For purposes of this definition, the beginning and the end of
the line count as Unicode whitespace.

Here are some examples of delimiter runs.

- left-flanking but not right-flanking:

  \`\`\`
  ***abc
    _abc
  **"abc"
   _"abc"
  \`\`\`

- right-flanking but not left-flanking:

  \`\`\`
   abc***
   abc_
  "abc"**
  "abc"_
  \`\`\`

- Both left and right-flanking:

  \`\`\`
   abc***def
  "abc"_"def"
  \`\`\`

- Neither left nor right-flanking:

  \`\`\`
  abc *** def
  a _ b
  \`\`\`

(The idea of distinguishing left-flanking and right-flanking
delimiter runs based on the character before and the character
after comes from Roopesh Chander's
[vfmd](http://www.vfmd.org/vfmd-spec/specification/#procedure-for-identifying-emphasis-tags).
vfmd uses the terminology "emphasis indicator string" instead of "delimiter
run," and its rules for distinguishing left- and right-flanking runs
are a bit more complex than the ones given here.)

The following rules define emphasis and strong emphasis:

1.  A single \`*\` character [can open emphasis](@)
    iff (if and only if) it is part of a [left-flanking delimiter run].

2.  A single \`_\` character [can open emphasis] iff
    it is part of a [left-flanking delimiter run]
    and either (a) not part of a [right-flanking delimiter run]
    or (b) part of a [right-flanking delimiter run]
    preceded by punctuation.

3.  A single \`*\` character [can close emphasis](@)
    iff it is part of a [right-flanking delimiter run].

4.  A single \`_\` character [can close emphasis] iff
    it is part of a [right-flanking delimiter run]
    and either (a) not part of a [left-flanking delimiter run]
    or (b) part of a [left-flanking delimiter run]
    followed by punctuation.

5.  A double \`**\` [can open strong emphasis](@)
    iff it is part of a [left-flanking delimiter run].

6.  A double \`__\` [can open strong emphasis] iff
    it is part of a [left-flanking delimiter run]
    and either (a) not part of a [right-flanking delimiter run]
    or (b) part of a [right-flanking delimiter run]
    preceded by punctuation.

7.  A double \`**\` [can close strong emphasis](@)
    iff it is part of a [right-flanking delimiter run].

8.  A double \`__\` [can close strong emphasis] iff
    it is part of a [right-flanking delimiter run]
    and either (a) not part of a [left-flanking delimiter run]
    or (b) part of a [left-flanking delimiter run]
    followed by punctuation.

9.  Emphasis begins with a delimiter that [can open emphasis] and ends
    with a delimiter that [can close emphasis], and that uses the same
    character (\`_\` or \`*\`) as the opening delimiter. The
    opening and closing delimiters must belong to separate
    [delimiter runs]. If one of the delimiters can both
    open and close emphasis, then the sum of the lengths of the
    delimiter runs containing the opening and closing delimiters
    must not be a multiple of 3 unless both lengths are
    multiples of 3.

10. Strong emphasis begins with a delimiter that
    [can open strong emphasis] and ends with a delimiter that
    [can close strong emphasis], and that uses the same character
    (\`_\` or \`*\`) as the opening delimiter. The
    opening and closing delimiters must belong to separate
    [delimiter runs]. If one of the delimiters can both open
    and close strong emphasis, then the sum of the lengths of
    the delimiter runs containing the opening and closing
    delimiters must not be a multiple of 3 unless both lengths
    are multiples of 3.

11. A literal \`*\` character cannot occur at the beginning or end of
    \`*\`-delimited emphasis or \`**\`-delimited strong emphasis, unless it
    is backslash-escaped.

12. A literal \`_\` character cannot occur at the beginning or end of
    \`_\`-delimited emphasis or \`__\`-delimited strong emphasis, unless it
    is backslash-escaped.

Where rules 1--12 above are compatible with multiple parsings,
the following principles resolve ambiguity:

13. The number of nestings should be minimized. Thus, for example,
    an interpretation \`<strong>...</strong>\` is always preferred to
    \`<em><em>...</em></em>\`.

14. An interpretation \`<em><strong>...</strong></em>\` is always
    preferred to \`<strong><em>...</em></strong>\`.

15. When two potential emphasis or strong emphasis spans overlap,
    so that the second begins before the first ends and ends after
    the first ends, the first takes precedence. Thus, for example,
    \`*foo _bar* baz_\` is parsed as \`<em>foo _bar</em> baz_\` rather
    than \`*foo <em>bar* baz</em>\`.

16. When there are two potential emphasis or strong emphasis spans
    with the same closing delimiter, the shorter one (the one that
    opens later) takes precedence. Thus, for example,
    \`**foo **bar baz**\` is parsed as \`**foo <strong>bar baz</strong>\`
    rather than \`<strong>foo **bar baz</strong>\`.

17. Inline code spans, links, images, and HTML tags group more tightly
    than emphasis. So, when there is a choice between an interpretation
    that contains one of these elements and one that does not, the
    former always wins. Thus, for example, \`*[foo*](bar)\` is
    parsed as \`*<a href="bar">foo*</a>\` rather than as
    \`<em>[foo</em>](bar)\`.

These rules can be illustrated through a series of examples.

Rule 1:

\`\`\`example
*foo bar*
.
<p><em>foo bar</em></p>
\`\`\`

This is not emphasis, because the opening \`*\` is followed by
whitespace, and hence not part of a [left-flanking delimiter run]:

\`\`\`example
a * foo bar*
.
<p>a * foo bar*</p>
\`\`\`

This is not emphasis, because the opening \`*\` is preceded
by an alphanumeric and followed by punctuation, and hence
not part of a [left-flanking delimiter run]:

\`\`\`example
a*"foo"*
.
<p>a*&quot;foo&quot;*</p>
\`\`\`

Unicode nonbreaking spaces count as whitespace, too:

\`\`\`example
* a *
.
<p>* a *</p>
\`\`\`

Intraword emphasis with \`*\` is permitted:

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

Rule 2:

\`\`\`example
_foo bar_
.
<p><em>foo bar</em></p>
\`\`\`

This is not emphasis, because the opening \`_\` is followed by
whitespace:

\`\`\`example
_ foo bar_
.
<p>_ foo bar_</p>
\`\`\`

This is not emphasis, because the opening \`_\` is preceded
by an alphanumeric and followed by punctuation:

\`\`\`example
a_"foo"_
.
<p>a_&quot;foo&quot;_</p>
\`\`\`

Emphasis with \`_\` is not allowed inside words:

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

Here \`_\` does not generate emphasis, because the first delimiter run
is right-flanking and the second left-flanking:

\`\`\`example
aa_"bb"_cc
.
<p>aa_&quot;bb&quot;_cc</p>
\`\`\`

This is emphasis, even though the opening delimiter is
both left- and right-flanking, because it is preceded by
punctuation:

\`\`\`example
foo-_(bar)_
.
<p>foo-<em>(bar)</em></p>
\`\`\`

Rule 3:

This is not emphasis, because the closing delimiter does
not match the opening delimiter:

\`\`\`example
_foo*
.
<p>_foo*</p>
\`\`\`

This is not emphasis, because the closing \`*\` is preceded by
whitespace:

\`\`\`example
*foo bar *
.
<p>*foo bar *</p>
\`\`\`

A newline also counts as whitespace:

\`\`\`example
*foo bar
*
.
<p>*foo bar
*</p>
\`\`\`

This is not emphasis, because the second \`*\` is
preceded by punctuation and followed by an alphanumeric
(hence it is not part of a [right-flanking delimiter run]:

\`\`\`example
*(*foo)
.
<p>*(*foo)</p>
\`\`\`

The point of this restriction is more easily appreciated
with this example:

\`\`\`example
*(*foo*)*
.
<p><em>(<em>foo</em>)</em></p>
\`\`\`

Intraword emphasis with \`*\` is allowed:

\`\`\`example
*foo*bar
.
<p><em>foo</em>bar</p>
\`\`\`

Rule 4:

This is not emphasis, because the closing \`_\` is preceded by
whitespace:

\`\`\`example
_foo bar _
.
<p>_foo bar _</p>
\`\`\`

This is not emphasis, because the second \`_\` is
preceded by punctuation and followed by an alphanumeric:

\`\`\`example
_(_foo)
.
<p>_(_foo)</p>
\`\`\`

This is emphasis within emphasis:

\`\`\`example
_(_foo_)_
.
<p><em>(<em>foo</em>)</em></p>
\`\`\`

Intraword emphasis is disallowed for \`_\`:

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

This is emphasis, even though the closing delimiter is
both left- and right-flanking, because it is followed by
punctuation:

\`\`\`example
_(bar)_.
.
<p><em>(bar)</em>.</p>
\`\`\`

Rule 5:

\`\`\`example
**foo bar**
.
<p><strong>foo bar</strong></p>
\`\`\`

This is not strong emphasis, because the opening delimiter is
followed by whitespace:

\`\`\`example
** foo bar**
.
<p>** foo bar**</p>
\`\`\`

This is not strong emphasis, because the opening \`**\` is preceded
by an alphanumeric and followed by punctuation, and hence
not part of a [left-flanking delimiter run]:

\`\`\`example
a**"foo"**
.
<p>a**&quot;foo&quot;**</p>
\`\`\`

Intraword strong emphasis with \`**\` is permitted:

\`\`\`example
foo**bar**
.
<p>foo<strong>bar</strong></p>
\`\`\`

Rule 6:

\`\`\`example
__foo bar__
.
<p><strong>foo bar</strong></p>
\`\`\`

This is not strong emphasis, because the opening delimiter is
followed by whitespace:

\`\`\`example
__ foo bar__
.
<p>__ foo bar__</p>
\`\`\`

A newline counts as whitespace:

\`\`\`example
__
foo bar__
.
<p>__
foo bar__</p>
\`\`\`

This is not strong emphasis, because the opening \`__\` is preceded
by an alphanumeric and followed by punctuation:

\`\`\`example
a__"foo"__
.
<p>a__&quot;foo&quot;__</p>
\`\`\`

Intraword strong emphasis is forbidden with \`__\`:

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

This is strong emphasis, even though the opening delimiter is
both left- and right-flanking, because it is preceded by
punctuation:

\`\`\`example
foo-__(bar)__
.
<p>foo-<strong>(bar)</strong></p>
\`\`\`

Rule 7:

This is not strong emphasis, because the closing delimiter is preceded
by whitespace:

\`\`\`example
**foo bar **
.
<p>**foo bar **</p>
\`\`\`

(Nor can it be interpreted as an emphasized \`*foo bar *\`, because of
Rule 11.)

This is not strong emphasis, because the second \`**\` is
preceded by punctuation and followed by an alphanumeric:

\`\`\`example
**(**foo)
.
<p>**(**foo)</p>
\`\`\`

The point of this restriction is more easily appreciated
with these examples:

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

Intraword emphasis:

\`\`\`example
**foo**bar
.
<p><strong>foo</strong>bar</p>
\`\`\`

Rule 8:

This is not strong emphasis, because the closing delimiter is
preceded by whitespace:

\`\`\`example
__foo bar __
.
<p>__foo bar __</p>
\`\`\`

This is not strong emphasis, because the second \`__\` is
preceded by punctuation and followed by an alphanumeric:

\`\`\`example
__(__foo)
.
<p>__(__foo)</p>
\`\`\`

The point of this restriction is more easily appreciated
with this example:

\`\`\`example
_(__foo__)_
.
<p><em>(<strong>foo</strong>)</em></p>
\`\`\`

Intraword strong emphasis is forbidden with \`__\`:

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

This is strong emphasis, even though the closing delimiter is
both left- and right-flanking, because it is followed by
punctuation:

\`\`\`example
__(bar)__.
.
<p><strong>(bar)</strong>.</p>
\`\`\`

Rule 9:

Any nonempty sequence of inline elements can be the contents of an
emphasized span.

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

In particular, emphasis and strong emphasis can be nested
inside emphasis:

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

Note that in the preceding case, the interpretation

\`\`\`markdown
<p><em>foo</em><em>bar<em></em>baz</em></p>
\`\`\`

is precluded by the condition that a delimiter that
can both open and close (like the \`*\` after \`foo\`)
cannot form emphasis if the sum of the lengths of
the delimiter runs containing the opening and
closing delimiters is a multiple of 3 unless
both lengths are multiples of 3.

For the same reason, we don't get two consecutive
emphasis sections in this example:

\`\`\`example
*foo**bar*
.
<p><em>foo**bar</em></p>
\`\`\`

The same condition ensures that the following
cases are all strong emphasis nested inside
emphasis, even when the interior spaces are
omitted:

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

When the lengths of the interior closing and opening
delimiter runs are _both_ multiples of 3, though,
they can match to create emphasis:

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

Indefinite levels of nesting are possible:

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

There can be no empty emphasis or strong emphasis:

\`\`\`example
** is not an empty emphasis
.
<p>** is not an empty emphasis</p>
\`\`\`

\`\`\`example
**** is not an empty strong emphasis
.
<p>**** is not an empty strong emphasis</p>
\`\`\`

Rule 10:

Any nonempty sequence of inline elements can be the contents of an
strongly emphasized span.

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

In particular, emphasis and strong emphasis can be nested
inside strong emphasis:

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

Indefinite levels of nesting are possible:

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

There can be no empty emphasis or strong emphasis:

\`\`\`example
__ is not an empty emphasis
.
<p>__ is not an empty emphasis</p>
\`\`\`

\`\`\`example
____ is not an empty strong emphasis
.
<p>____ is not an empty strong emphasis</p>
\`\`\`

Rule 11:

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

Note that when delimiters do not match evenly, Rule 11 determines
that the excess literal \`*\` characters will appear outside of the
emphasis, rather than inside it:

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

Rule 12:

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

Note that when delimiters do not match evenly, Rule 12 determines
that the excess literal \`_\` characters will appear outside of the
emphasis, rather than inside it:

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

Rule 13 implies that if you want emphasis nested directly inside
emphasis, you must use different delimiters:

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

However, strong emphasis within strong emphasis is possible without
switching delimiters:

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

Rule 13 can be applied to arbitrarily long sequences of
delimiters:

\`\`\`example
******foo******
.
<p><strong>foo</strong></p>
\`\`\`

Rule 14:

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

Rule 15:

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

Rule 16:

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

Rule 17:

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

## Strikethrough (extension)

GFM enables the \`strikethrough\` extension, where an additional emphasis type is
available.

Strikethrough text is any text wrapped in two tildes (\`~\`).

\`\`\`example strikethrough
~~Hi~~ Hello, world!
.
<p><del>Hi</del> Hello, world!</p>
\`\`\`

As with regular emphasis delimiters, a new paragraph will cause strikethrough
parsing to cease:

\`\`\`example strikethrough
This ~~has a

new paragraph~~.
.
<p>This ~~has a</p>
<p>new paragraph~~.</p>
\`\`\`

</div>

## Links

A link contains [link text] (the visible text), a [link destination]
(the URI that is the link destination), and optionally a [link title].
There are two basic kinds of links in Markdown. In [inline links] the
destination and title are given immediately after the link text. In
[reference links] the destination and title are defined elsewhere in
the document.

A [link text](@) consists of a sequence of zero or more
inline elements enclosed by square brackets (\`[\` and \`]\`). The
following rules apply:

- Links may not contain other links, at any level of nesting. If
  multiple otherwise valid link definitions appear nested inside each
  other, the inner-most definition is used.

- Brackets are allowed in the [link text] only if (a) they
  are backslash-escaped or (b) they appear as a matched pair of brackets,
  with an open bracket \`[\`, a sequence of zero or more inlines, and
  a close bracket \`]\`.

- Backtick [code spans], [autolinks], and raw [HTML tags] bind more tightly
  than the brackets in link text. Thus, for example,
  \`\` [foo\`]\` \`\` could not be a link text, since the second \`]\`
  is part of a code span.

- The brackets in link text bind more tightly than markers for
  [emphasis and strong emphasis]. Thus, for example, \`*[foo*](url)\` is a link.

A [link destination](@) consists of either

- a sequence of zero or more characters between an opening \`<\` and a
  closing \`>\` that contains no line breaks or unescaped
  \`<\` or \`>\` characters, or

- a nonempty sequence of characters that does not start with
  \`<\`, does not include ASCII space or control characters, and
  includes parentheses only if (a) they are backslash-escaped or
  (b) they are part of a balanced pair of unescaped parentheses.
  (Implementations may impose limits on parentheses nesting to
  avoid performance issues, but at least three levels of nesting
  should be supported.)

A [link title](@) consists of either

- a sequence of zero or more characters between straight double-quote
  characters (\`"\`), including a \`"\` character only if it is
  backslash-escaped, or

- a sequence of zero or more characters between straight single-quote
  characters (\`'\`), including a \`'\` character only if it is
  backslash-escaped, or

- a sequence of zero or more characters between matching parentheses
  (\`(...)\`), including a \`(\` or \`)\` character only if it is
  backslash-escaped.

Although [link titles] may span multiple lines, they may not contain
a [blank line].

An [inline link](@) consists of a [link text] followed immediately
by a left parenthesis \`(\`, optional [whitespace], an optional
[link destination], an optional [link title] separated from the link
destination by [whitespace], optional [whitespace], and a right
parenthesis \`)\`. The link's text consists of the inlines contained
in the [link text] (excluding the enclosing square brackets).
The link's URI consists of the link destination, excluding enclosing
\`<...>\` if present, with backslash-escapes in effect as described
above. The link's title consists of the link title, excluding its
enclosing delimiters, with backslash-escapes in effect as described
above.

Here is a simple inline link:

\`\`\`example
[link](/uri "title")
.
<p><a href="/uri" title="title">link</a></p>
\`\`\`

The title may be omitted:

\`\`\`example
[link](/uri)
.
<p><a href="/uri">link</a></p>
\`\`\`

Both the title and the destination may be omitted:

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

The destination can only contain spaces if it is
enclosed in pointy brackets:

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

The destination cannot contain line breaks,
even if enclosed in pointy brackets:

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

The destination can contain \`)\` if it is enclosed
in pointy brackets:

\`\`\`example
[a](<b)c>)
.
<p><a href="b)c">a</a></p>
\`\`\`

Pointy brackets that enclose links must be unescaped:

\`\`\`example
[link](<foo\\>)
.
<p>[link](&lt;foo&gt;)</p>
\`\`\`

These are not links, because the opening pointy bracket
is not matched properly:

\`\`\`example
[a](<b)c
[a](<b)c>
[a](<b>c)
.
<p>[a](&lt;b)c
[a](&lt;b)c&gt;
[a](<b>c)</p>
\`\`\`

Parentheses inside the link destination may be escaped:

\`\`\`example
[link](\\(foo\\))
.
<p><a href="(foo)">link</a></p>
\`\`\`

Any number of parentheses are allowed without escaping, as long as they are
balanced:

\`\`\`example
[link](foo(and(bar)))
.
<p><a href="foo(and(bar))">link</a></p>
\`\`\`

However, if you have unbalanced parentheses, you need to escape or use the
\`<...>\` form:

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

Parentheses and other symbols can also be escaped, as usual
in Markdown:

\`\`\`example
[link](foo\\)\\:)
.
<p><a href="foo):">link</a></p>
\`\`\`

A link can contain fragment identifiers and queries:

\`\`\`example
[link](#fragment)

[link](http://example.com#fragment)

[link](http://example.com?foo=3#frag)
.
<p><a href="#fragment">link</a></p>
<p><a href="http://example.com#fragment">link</a></p>
<p><a href="http://example.com?foo=3#frag">link</a></p>
\`\`\`

Note that a backslash before a non-escapable character is
just a backslash:

\`\`\`example
[link](foo\\bar)
.
<p><a href="foo%5Cbar">link</a></p>
\`\`\`

URL-escaping should be left alone inside the destination, as all
URL-escaped characters are also valid URL characters. Entity and
numerical character references in the destination will be parsed
into the corresponding Unicode code points, as usual. These may
be optionally URL-escaped when written as HTML, but this spec
does not enforce any particular policy for rendering URLs in
HTML or other formats. Renderers may make different decisions
about how to escape or normalize URLs in the output.

\`\`\`example
[link](foo%20b&auml;)
.
<p><a href="foo%20b%C3%A4">link</a></p>
\`\`\`

Note that, because titles can often be parsed as destinations,
if you try to omit the destination and keep the title, you'll
get unexpected results:

\`\`\`example
[link]("title")
.
<p><a href="%22title%22">link</a></p>
\`\`\`

Titles may be in single quotes, double quotes, or parentheses:

\`\`\`example
[link](/url "title")
[link](/url 'title')
[link](/url (title))
.
<p><a href="/url" title="title">link</a>
<a href="/url" title="title">link</a>
<a href="/url" title="title">link</a></p>
\`\`\`

Backslash escapes and entity and numeric character references
may be used in titles:

\`\`\`example
[link](/url "title \\"&quot;")
.
<p><a href="/url" title="title &quot;&quot;">link</a></p>
\`\`\`

Titles must be separated from the link using a [whitespace].
Other [Unicode whitespace] like non-breaking space doesn't work.

\`\`\`example
[link](/url "title")
.
<p><a href="/url%C2%A0%22title%22">link</a></p>
\`\`\`

Nested balanced quotes are not allowed without escaping:

\`\`\`example
[link](/url "title "and" title")
.
<p>[link](/url &quot;title &quot;and&quot; title&quot;)</p>
\`\`\`

But it is easy to work around this by using a different quote type:

\`\`\`example
[link](/url 'title "and" title')
.
<p><a href="/url" title="title &quot;and&quot; title">link</a></p>
\`\`\`

(Note: \`Markdown.pl\` did allow double quotes inside a double-quoted
title, and its test suite included a test demonstrating this.
But it is hard to see a good rationale for the extra complexity this
brings, since there are already many ways---backslash escaping,
entity and numeric character references, or using a different
quote type for the enclosing title---to write titles containing
double quotes. \`Markdown.pl\`'s handling of titles has a number
of other strange features. For example, it allows single-quoted
titles in inline links, but not reference links. And, in
reference links but not inline links, it allows a title to begin
with \`"\` and end with \`)\`. \`Markdown.pl\` 1.0.1 even allows
titles with no closing quotation mark, though 1.0.2b8 does not.
It seems preferable to adopt a simple, rational rule that works
the same way in inline links and link reference definitions.)

[Whitespace] is allowed around the destination and title:

\`\`\`example
[link](   /uri
  "title"  )
.
<p><a href="/uri" title="title">link</a></p>
\`\`\`

But it is not allowed between the link text and the
following parenthesis:

\`\`\`example
[link] (/uri)
.
<p>[link] (/uri)</p>
\`\`\`

The link text may contain balanced brackets, but not unbalanced ones,
unless they are escaped:

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

The link text may contain inline content:

\`\`\`example
[link *foo **bar** \`#\`*](/uri)
.
<p><a href="/uri">link <em>foo <strong>bar</strong> <code>#</code></em></a></p>
\`\`\`

\`\`\`example
[![moon](moon.jpg)](/uri)
.
<p><a href="/uri"><img src="moon.jpg" alt="moon" /></a></p>
\`\`\`

However, links may not contain other links, at any level of nesting.

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

These cases illustrate the precedence of link text grouping over
emphasis grouping:

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

Note that brackets that _aren't_ part of links do not take
precedence:

\`\`\`example
*foo [bar* baz]
.
<p><em>foo [bar</em> baz]</p>
\`\`\`

These cases illustrate the precedence of HTML tags, code spans,
and autolinks over link grouping:

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

There are three kinds of [reference link](@)s:
[full](#full-reference-link), [collapsed](#collapsed-reference-link),
and [shortcut](#shortcut-reference-link).

A [full reference link](@)
consists of a [link text] immediately followed by a [link label]
that [matches] a [link reference definition] elsewhere in the document.

A [link label](@) begins with a left bracket (\`[\`) and ends
with the first right bracket (\`]\`) that is not backslash-escaped.
Between these brackets there must be at least one [non-whitespace character].
Unescaped square bracket characters are not allowed inside the
opening and closing square brackets of [link labels]. A link
label can have at most 999 characters inside the square
brackets.

One label [matches](@)
another just in case their normalized forms are equal. To normalize a
label, strip off the opening and closing brackets,
perform the _Unicode case fold_, strip leading and trailing
[whitespace] and collapse consecutive internal
[whitespace] to a single space. If there are multiple
matching reference link definitions, the one that comes first in the
document is used. (It is desirable in such cases to emit a warning.)

The contents of the first link label are parsed as inlines, which are
used as the link's text. The link's URI and title are provided by the
matching [link reference definition].

Here is a simple example:

\`\`\`example
[foo][bar]

[bar]: /url "title"
.
<p><a href="/url" title="title">foo</a></p>
\`\`\`

The rules for the [link text] are the same as with
[inline links]. Thus:

The link text may contain balanced brackets, but not unbalanced ones,
unless they are escaped:

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

The link text may contain inline content:

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
<p><a href="/uri"><img src="moon.jpg" alt="moon" /></a></p>
\`\`\`

However, links may not contain other links, at any level of nesting.

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

(In the examples above, we have two [shortcut reference links]
instead of one [full reference link].)

The following cases illustrate the precedence of link text grouping over
emphasis grouping:

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

These cases illustrate the precedence of HTML tags, code spans,
and autolinks over link grouping:

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

Matching is case-insensitive:

\`\`\`example
[foo][BaR]

[bar]: /url "title"
.
<p><a href="/url" title="title">foo</a></p>
\`\`\`

Unicode case fold is used:

\`\`\`example
[Толпой][Толпой] is a Russian word.

[ТОЛПОЙ]: /url
.
<p><a href="/url">Толпой</a> is a Russian word.</p>
\`\`\`

Consecutive internal [whitespace] is treated as one space for
purposes of determining matching:

\`\`\`example
[Foo
  bar]: /url

[Baz][Foo bar]
.
<p><a href="/url">Baz</a></p>
\`\`\`

No [whitespace] is allowed between the [link text] and the
[link label]:

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

This is a departure from John Gruber's original Markdown syntax
description, which explicitly allows whitespace between the link
text and the link label. It brings reference links in line with
[inline links], which (according to both original Markdown and
this spec) cannot have whitespace after the link text. More
importantly, it prevents inadvertent capture of consecutive
[shortcut reference links]. If whitespace is allowed between the
link text and the link label, then in the following we will have
a single reference link, not two shortcut reference links, as
intended:

\`\`\`markdown
[foo]
[bar]

[foo]: /url1
[bar]: /url2
\`\`\`

(Note that [shortcut reference links] were introduced by Gruber
himself in a beta version of \`Markdown.pl\`, but never included
in the official syntax description. Without shortcut reference
links, it is harmless to allow space between the link text and
link label; but once shortcut references are introduced, it is
too dangerous to allow this, as it frequently leads to
unintended results.)

When there are multiple matching [link reference definitions],
the first is used:

\`\`\`example
[foo]: /url1

[foo]: /url2

[bar][foo]
.
<p><a href="/url1">bar</a></p>
\`\`\`

Note that matching is performed on normalized strings, not parsed
inline content. So the following does not match, even though the
labels define equivalent inline content:

\`\`\`example
[bar][foo\\!]

[foo!]: /url
.
<p>[bar][foo!]</p>
\`\`\`

[Link labels] cannot contain brackets, unless they are
backslash-escaped:

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

Note that in this example \`]\` is not backslash-escaped:

\`\`\`example
[bar\\\\]: /uri

[bar\\\\]
.
<p><a href="/uri">bar\\</a></p>
\`\`\`

A [link label] must contain at least one [non-whitespace character]:

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

A [collapsed reference link](@)
consists of a [link label] that [matches] a
[link reference definition] elsewhere in the
document, followed by the string \`[]\`.
The contents of the first link label are parsed as inlines,
which are used as the link's text. The link's URI and title are
provided by the matching reference link definition. Thus,
\`[foo][]\` is equivalent to \`[foo][foo]\`.

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

The link labels are case-insensitive:

\`\`\`example
[Foo][]

[foo]: /url "title"
.
<p><a href="/url" title="title">Foo</a></p>
\`\`\`

As with full reference links, [whitespace] is not
allowed between the two sets of brackets:

\`\`\`example
[foo]
[]

[foo]: /url "title"
.
<p><a href="/url" title="title">foo</a>
[]</p>
\`\`\`

A [shortcut reference link](@)
consists of a [link label] that [matches] a
[link reference definition] elsewhere in the
document and is not followed by \`[]\` or a link label.
The contents of the first link label are parsed as inlines,
which are used as the link's text. The link's URI and title
are provided by the matching link reference definition.
Thus, \`[foo]\` is equivalent to \`[foo][]\`.

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

The link labels are case-insensitive:

\`\`\`example
[Foo]

[foo]: /url "title"
.
<p><a href="/url" title="title">Foo</a></p>
\`\`\`

A space after the link text should be preserved:

\`\`\`example
[foo] bar

[foo]: /url
.
<p><a href="/url">foo</a> bar</p>
\`\`\`

If you just want bracketed text, you can backslash-escape the
opening bracket to avoid links:

\`\`\`example
\\[foo]

[foo]: /url "title"
.
<p>[foo]</p>
\`\`\`

Note that this is a link, because a link label ends with the first
following closing bracket:

\`\`\`example
[foo*]: /url

*[foo*]
.
<p>*<a href="/url">foo*</a></p>
\`\`\`

Full and compact references take precedence over shortcut
references:

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

Inline links also take precedence:

\`\`\`example
[foo]()

[foo]: /url1
.
<p><a href="">foo</a></p>
\`\`\`

\`\`\`example
[foo](not a link)

[foo]: /url1
.
<p><a href="/url1">foo</a>(not a link)</p>
\`\`\`

In the following case \`[bar][baz]\` is parsed as a reference,
\`[foo]\` as normal text:

\`\`\`example
[foo][bar][baz]

[baz]: /url
.
<p>[foo]<a href="/url">bar</a></p>
\`\`\`

Here, though, \`[foo][bar]\` is parsed as a reference, since
\`[bar]\` is defined:

\`\`\`example
[foo][bar][baz]

[baz]: /url1
[bar]: /url2
.
<p><a href="/url2">foo</a><a href="/url1">baz</a></p>
\`\`\`

Here \`[foo]\` is not parsed as a shortcut reference, because it
is followed by a link label (even though \`[bar]\` is not defined):

\`\`\`example
[foo][bar][baz]

[baz]: /url1
[foo]: /url2
.
<p>[foo]<a href="/url1">bar</a></p>
\`\`\`

## Images

Syntax for images is like the syntax for links, with one
difference. Instead of [link text], we have an
[image description](@). The rules for this are the
same as for [link text], except that (a) an
image description starts with \`![\` rather than \`[\`, and
(b) an image description may contain links.
An image description has inline elements
as its contents. When an image is rendered to HTML,
this is standardly used as the image's \`alt\` attribute.

\`\`\`example
![foo](/url "title")
.
<p><img src="/url" alt="foo" title="title" /></p>
\`\`\`

\`\`\`example
![foo *bar*]

[foo *bar*]: train.jpg "train & tracks"
.
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks" /></p>
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

Though this spec is concerned with parsing, not rendering, it is
recommended that in rendering to HTML, only the plain string content
of the [image description] be used. Note that in
the above example, the alt attribute's value is \`foo bar\`, not \`foo
[bar](/url)\` or \`foo <a href="/url">bar</a>\`. Only the plain string
content is rendered, without formatting.

\`\`\`example
![foo *bar*][]

[foo *bar*]: train.jpg "train & tracks"
.
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks" /></p>
\`\`\`

\`\`\`example
![foo *bar*][foobar]

[FOOBAR]: train.jpg "train & tracks"
.
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks" /></p>
\`\`\`

\`\`\`example
![foo](train.jpg)
.
<p><img src="train.jpg" alt="foo" /></p>
\`\`\`

\`\`\`example
My ![foo bar](/path/to/train.jpg  "title"   )
.
<p>My <img src="/path/to/train.jpg" alt="foo bar" title="title" /></p>
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

Reference-style:

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

Collapsed:

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

The labels are case-insensitive:

\`\`\`example
![Foo][]

[foo]: /url "title"
.
<p><img src="/url" alt="Foo" title="title" /></p>
\`\`\`

As with reference links, [whitespace] is not allowed
between the two sets of brackets:

\`\`\`example
![foo]
[]

[foo]: /url "title"
.
<p><img src="/url" alt="foo" title="title" />
[]</p>
\`\`\`

Shortcut:

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

Note that link labels cannot contain unescaped brackets:

\`\`\`example
![[foo]]

[[foo]]: /url "title"
.
<p>![[foo]]</p>
<p>[[foo]]: /url &quot;title&quot;</p>
\`\`\`

The link labels are case-insensitive:

\`\`\`example
![Foo]

[foo]: /url "title"
.
<p><img src="/url" alt="Foo" title="title" /></p>
\`\`\`

If you just want a literal \`!\` followed by bracketed text, you can
backslash-escape the opening \`[\`:

\`\`\`example
!\\[foo]

[foo]: /url "title"
.
<p>![foo]</p>
\`\`\`

If you want a link after a literal \`!\`, backslash-escape the
\`!\`:

\`\`\`example
\\![foo]

[foo]: /url "title"
.
<p>!<a href="/url" title="title">foo</a></p>
\`\`\`

## Autolinks

[Autolink](@)s are absolute URIs and email addresses inside
\`<\` and \`>\`. They are parsed as links, with the URL or email address
as the link label.

A [URI autolink](@) consists of \`<\`, followed by an
[absolute URI] followed by \`>\`. It is parsed as
a link to the URI, with the URI as the link's label.

An [absolute URI](@),
for these purposes, consists of a [scheme] followed by a colon (\`:\`)
followed by zero or more characters other than ASCII
[whitespace] and control characters, \`<\`, and \`>\`. If
the URI includes these characters, they must be percent-encoded
(e.g. \`%20\` for a space).

For purposes of this spec, a [scheme](@) is any sequence
of 2--32 characters beginning with an ASCII letter and followed
by any combination of ASCII letters, digits, or the symbols plus
("+"), period ("."), or hyphen ("-").

Here are some valid autolinks:

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

Uppercase is also fine:

\`\`\`example
<MAILTO:FOO@BAR.BAZ>
.
<p><a href="MAILTO:FOO@BAR.BAZ">MAILTO:FOO@BAR.BAZ</a></p>
\`\`\`

Note that many strings that count as [absolute URIs] for
purposes of this spec are not valid URIs, because their
schemes are not registered or because of other problems
with their syntax:

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

Spaces are not allowed in autolinks:

\`\`\`example
<http://foo.bar/baz bim>
.
<p>&lt;http://foo.bar/baz bim&gt;</p>
\`\`\`

Backslash-escapes do not work inside autolinks:

\`\`\`example
<http://example.com/\\[\\>
.
<p><a href="http://example.com/%5C%5B%5C">http://example.com/\\[\\</a></p>
\`\`\`

An [email autolink](@)
consists of \`<\`, followed by an [email address],
followed by \`>\`. The link's label is the email address,
and the URL is \`mailto:\` followed by the email address.

An [email address](@),
for these purposes, is anything that matches
the [non-normative regex from the HTML5
spec](<https://html.spec.whatwg.org/multipage/forms.html#e-mail-state-(type=email)>):

    /^[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?
    (?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

Examples of email autolinks:

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

Backslash-escapes do not work inside email autolinks:

\`\`\`example
<foo\\+@bar.example.com>
.
<p>&lt;foo+@bar.example.com&gt;</p>
\`\`\`

These are not autolinks:

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

## Autolinks (extension)

GFM enables the \`autolink\` extension, where autolinks will be recognised in a
greater number of conditions.

[Autolink]s can also be constructed without requiring the use of \`<\` and to \`>\`
to delimit them, although they will be recognized under a smaller set of
circumstances. All such recognized autolinks can only come at the beginning of
a line, after whitespace, or any of the delimiting characters \`*\`, \`_\`, \`~\`,
and \`(\`.

An [extended www autolink](@) will be recognized
when the text \`www.\` is found followed by a [valid domain].
A [valid domain](@) consists of segments
of alphanumeric characters, underscores (\`_\`) and hyphens (\`-\`)
separated by periods (\`.\`).
There must be at least one period,
and no underscores may be present in the last two segments of the domain.

The scheme \`http\` will be inserted automatically:

\`\`\`example autolink
www.commonmark.org
.
<p><a href="http://www.commonmark.org">www.commonmark.org</a></p>
\`\`\`

After a [valid domain], zero or more non-space non-\`<\` characters may follow:

\`\`\`example autolink
Visit www.commonmark.org/help for more information.
.
<p>Visit <a href="http://www.commonmark.org/help">www.commonmark.org/help</a> for more information.</p>
\`\`\`

We then apply [extended autolink path validation](@) as follows:

Trailing punctuation (specifically, \`?\`, \`!\`, \`.\`, \`,\`, \`:\`, \`*\`, \`_\`, and \`~\`)
will not be considered part of the autolink, though they may be included in the
interior of the link:

\`\`\`example autolink
Visit www.commonmark.org.

Visit www.commonmark.org/a.b.
.
<p>Visit <a href="http://www.commonmark.org">www.commonmark.org</a>.</p>
<p>Visit <a href="http://www.commonmark.org/a.b">www.commonmark.org/a.b</a>.</p>
\`\`\`

When an autolink ends in \`)\`, we scan the entire autolink for the total number
of parentheses. If there is a greater number of closing parentheses than
opening ones, we don't consider the unmatched trailing parentheses part of the
autolink, in order to facilitate including an autolink inside a parenthesis:

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

This check is only done when the link ends in a closing parentheses \`)\`, so if
the only parentheses are in the interior of the autolink, no special rules are
applied:

\`\`\`example autolink
www.google.com/search?q=(business))+ok
.
<p><a href="http://www.google.com/search?q=(business))+ok">www.google.com/search?q=(business))+ok</a></p>
\`\`\`

If an autolink ends in a semicolon (\`;\`), we check to see if it appears to
resemble an [entity reference][entity references]; if the preceding text is \`&\`
followed by one or more alphanumeric characters. If so, it is excluded from
the autolink:

\`\`\`example autolink
www.google.com/search?q=commonmark&hl=en

www.google.com/search?q=commonmark&hl;
.
<p><a href="http://www.google.com/search?q=commonmark&amp;hl=en">www.google.com/search?q=commonmark&amp;hl=en</a></p>
<p><a href="http://www.google.com/search?q=commonmark">www.google.com/search?q=commonmark</a>&amp;hl;</p>
\`\`\`

\`<\` immediately ends an autolink.

\`\`\`example autolink
www.commonmark.org/he<lp
.
<p><a href="http://www.commonmark.org/he">www.commonmark.org/he</a>&lt;lp</p>
\`\`\`

An [extended url autolink](@) will be recognised when one of the schemes
\`http://\`, \`https://\`, or \`ftp://\`, followed by a [valid domain], then zero or
more non-space non-\`<\` characters according to
[extended autolink path validation]:

\`\`\`example autolink
http://commonmark.org

(Visit https://encrypted.google.com/search?q=Markup+(business))

Anonymous FTP is available at ftp://foo.bar.baz.
.
<p><a href="http://commonmark.org">http://commonmark.org</a></p>
<p>(Visit <a href="https://encrypted.google.com/search?q=Markup+(business)">https://encrypted.google.com/search?q=Markup+(business)</a>)</p>
<p>Anonymous FTP is available at <a href="ftp://foo.bar.baz">ftp://foo.bar.baz</a>.</p>
\`\`\`

An [extended email autolink](@) will be recognised when an email address is
recognised within any text node. Email addresses are recognised according to
the following rules:

- One ore more characters which are alphanumeric, or \`.\`, \`-\`, \`_\`, or \`+\`.
- An \`@\` symbol.
- One or more characters which are alphanumeric, or \`-\` or \`_\`,
  separated by periods (\`.\`).
  There must be at least one period.
  The last character must not be one of \`-\` or \`_\`.

The scheme \`mailto:\` will automatically be added to the generated link:

\`\`\`example autolink
foo@bar.baz
.
<p><a href="mailto:foo@bar.baz">foo@bar.baz</a></p>
\`\`\`

\`+\` can occur before the \`@\`, but not after.

\`\`\`example autolink
hello@mail+xyz.example isn't valid, but hello+xyz@mail.example is.
.
<p>hello@mail+xyz.example isn't valid, but <a href="mailto:hello+xyz@mail.example">hello+xyz@mail.example</a> is.</p>
\`\`\`

\`.\`, \`-\`, and \`_\` can occur on both sides of the \`@\`, but only \`.\` may occur at
the end of the email address, in which case it will not be considered part of
the address:

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

## Raw HTML

Text between \`<\` and \`>\` that looks like an HTML tag is parsed as a
raw HTML tag and will be rendered in HTML without escaping.
Tag and attribute names are not limited to current HTML tags,
so custom tags (and even, say, DocBook tags) may be used.

Here is the grammar for tags:

A [tag name](@) consists of an ASCII letter
followed by zero or more ASCII letters, digits, or
hyphens (\`-\`).

An [attribute](@) consists of [whitespace],
an [attribute name], and an optional
[attribute value specification].

An [attribute name](@)
consists of an ASCII letter, \`_\`, or \`:\`, followed by zero or more ASCII
letters, digits, \`_\`, \`.\`, \`:\`, or \`-\`. (Note: This is the XML
specification restricted to ASCII. HTML5 is laxer.)

An [attribute value specification](@)
consists of optional [whitespace],
a \`=\` character, optional [whitespace], and an [attribute
value].

An [attribute value](@)
consists of an [unquoted attribute value],
a [single-quoted attribute value], or a [double-quoted attribute value].

An [unquoted attribute value](@)
is a nonempty string of characters not
including [whitespace], \`"\`, \`'\`, \`=\`, \`<\`, \`>\`, or \`\` \` \`\`.

A [single-quoted attribute value](@)
consists of \`'\`, zero or more
characters not including \`'\`, and a final \`'\`.

A [double-quoted attribute value](@)
consists of \`"\`, zero or more
characters not including \`"\`, and a final \`"\`.

An [open tag](@) consists of a \`<\` character, a [tag name],
zero or more [attributes], optional [whitespace], an optional \`/\`
character, and a \`>\` character.

A [closing tag](@) consists of the string \`</\`, a
[tag name], optional [whitespace], and the character \`>\`.

An [HTML comment](@) consists of \`<!-->\`, \`<!--->\`, or \`<!--\`, a string of
characters not including the string \`-->\`, and \`-->\` (see the
[HTML spec](https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state)).

A [processing instruction](@)
consists of the string \`<?\`, a string
of characters not including the string \`?>\`, and the string
\`?>\`.

A [declaration](@) consists of the
string \`<!\`, a name consisting of one or more uppercase ASCII letters,
[whitespace], a string of characters not including the
character \`>\`, and the character \`>\`.

A [CDATA section](@) consists of
the string \`<![CDATA[\`, a string of characters not including the string
\`]]>\`, and the string \`]]>\`.

An [HTML tag](@) consists of an [open tag], a [closing tag],
an [HTML comment], a [processing instruction], a [declaration],
or a [CDATA section].

Here are some simple open tags:

\`\`\`example
<a><bab><c2c>
.
<p><a><bab><c2c></p>
\`\`\`

Empty elements:

\`\`\`example
<a/><b2/>
.
<p><a/><b2/></p>
\`\`\`

[Whitespace] is allowed:

\`\`\`example
<a  /><b2
data="foo" >
.
<p><a  /><b2
data="foo" ></p>
\`\`\`

With attributes:

\`\`\`example
<a foo="bar" bam = 'baz <em>"</em>'
_boolean zoop:33=zoop:33 />
.
<p><a foo="bar" bam = 'baz <em>"</em>'
_boolean zoop:33=zoop:33 /></p>
\`\`\`

Custom tag names can be used:

\`\`\`example
Foo <responsive-image src="foo.jpg" />
.
<p>Foo <responsive-image src="foo.jpg" /></p>
\`\`\`

Illegal tag names, not parsed as HTML:

\`\`\`example
<33> <__>
.
<p>&lt;33&gt; &lt;__&gt;</p>
\`\`\`

Illegal attribute names:

\`\`\`example
<a h*#ref="hi">
.
<p>&lt;a h*#ref=&quot;hi&quot;&gt;</p>
\`\`\`

Illegal attribute values:

\`\`\`example
<a href="hi'> <a href=hi'>
.
<p>&lt;a href=&quot;hi'&gt; &lt;a href=hi'&gt;</p>
\`\`\`

Illegal [whitespace]:

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

Missing [whitespace]:

\`\`\`example
<a href='bar'title=title>
.
<p>&lt;a href='bar'title=title&gt;</p>
\`\`\`

Closing tags:

\`\`\`example
</a></foo >
.
<p></a></foo ></p>
\`\`\`

Illegal attributes in closing tag:

\`\`\`example
</a href="foo">
.
<p>&lt;/a href=&quot;foo&quot;&gt;</p>
\`\`\`

Comments:

\`\`\`example
foo <!-- this is a --
comment - with hyphens -->
.
<p>foo <!-- this is a --
comment - with hyphens --></p>
\`\`\`

\`\`\`example
foo <!--> foo -->

foo <!---> foo -->
.
<p>foo <!--> foo --&gt;</p>
<p>foo <!---> foo --&gt;</p>
\`\`\`

Processing instructions:

\`\`\`example
foo <?php echo $a; ?>
.
<p>foo <?php echo $a; ?></p>
\`\`\`

Declarations:

\`\`\`example
foo <!ELEMENT br EMPTY>
.
<p>foo <!ELEMENT br EMPTY></p>
\`\`\`

CDATA sections:

\`\`\`example
foo <![CDATA[>&<]]>
.
<p>foo <![CDATA[>&<]]></p>
\`\`\`

Entity and numeric character references are preserved in HTML
attributes:

\`\`\`example
foo <a href="&ouml;">
.
<p>foo <a href="&ouml;"></p>
\`\`\`

Backslash escapes do not work in HTML attributes:

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

## Disallowed Raw HTML (extension)

GFM enables the \`tagfilter\` extension, where the following HTML tags will be
filtered when rendering HTML output:

- \`<title>\`
- \`<textarea>\`
- \`<style>\`
- \`<xmp>\`
- \`<iframe>\`
- \`<noembed>\`
- \`<noframes>\`
- \`<script>\`
- \`<plaintext>\`

Filtering is done by replacing the leading \`<\` with the entity \`&lt;\`. These
tags are chosen in particular as they change how HTML is interpreted in a way
unique to them (i.e. nested HTML is interpreted differently), and this is
usually undesireable in the context of other rendered Markdown content.

All other HTML tags are left untouched.

\`\`\`example tagfilter
<strong> <title> <style> <em>

<blockquote>
  <xmp> is disallowed.  <XMP> is also disallowed.
</blockquote>
.
<p><strong> &lt;title> &lt;style> <em></p>
<blockquote>
  &lt;xmp> is disallowed.  &lt;XMP> is also disallowed.
</blockquote>
\`\`\`

</div>

## Hard line breaks

A line break (not in a code span or HTML tag) that is preceded
by two or more spaces and does not occur at the end of a block
is parsed as a [hard line break](@) (rendered
in HTML as a \`<br />\` tag):

\`\`\`example
foo
baz
.
<p>foo<br />
baz</p>
\`\`\`

For a more visible alternative, a backslash before the
[line ending] may be used instead of two spaces:

\`\`\`example
foo\\
baz
.
<p>foo<br />
baz</p>
\`\`\`

More than two spaces can be used:

\`\`\`example
foo
baz
.
<p>foo<br />
baz</p>
\`\`\`

Leading spaces at the beginning of the next line are ignored:

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

Line breaks can occur inside emphasis, links, and other constructs
that allow inline content:

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

Line breaks do not occur inside code spans

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

or HTML tags:

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

Hard line breaks are for separating inline content within a block.
Neither syntax for hard line breaks works at the end of a paragraph or
other block element:

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

## Soft line breaks

A regular line break (not in a code span or HTML tag) that is not
preceded by two or more spaces or a backslash is parsed as a
[softbreak](@). (A softbreak may be rendered in HTML either as a
[line ending] or as a space. The result will be the same in
browsers. In the examples here, a [line ending] will be used.)

\`\`\`example
foo
baz
.
<p>foo
baz</p>
\`\`\`

Spaces at the end of the line and beginning of the next line are
removed:

\`\`\`example
foo
 baz
.
<p>foo
baz</p>
\`\`\`

A conforming parser may render a soft line break in HTML either as a
line break or as a space.

A renderer may also provide an option to render soft line breaks
as hard line breaks.

## Textual content

Any characters not given an interpretation by the above rules will
be parsed as plain textual content.

\`\`\`example
hello $.;'there
.
<p>hello $.;'there</p>
\`\`\`

\`\`\`example
Foo χρῆν
.
<p>Foo χρῆν</p>
\`\`\`

Internal spaces are preserved verbatim:

\`\`\`example
Multiple     spaces
.
<p>Multiple     spaces</p>
\`\`\`

<!-- END TESTS -->

# Appendix: A parsing strategy

In this appendix we describe some features of the parsing strategy
used in the CommonMark reference implementations.

## Overview

Parsing has two phases:

1. In the first phase, lines of input are consumed and the block
   structure of the document---its division into paragraphs, block quotes,
   list items, and so on---is constructed. Text is assigned to these
   blocks but not parsed. Link reference definitions are parsed and a
   map of links is constructed.

2. In the second phase, the raw text contents of paragraphs and headings
   are parsed into sequences of Markdown inline elements (strings,
   code spans, links, emphasis, and so on), using the map of link
   references constructed in phase 1.

At each point in processing, the document is represented as a tree of
**blocks**. The root of the tree is a \`document\` block. The \`document\`
may have any number of other blocks as **children**. These children
may, in turn, have other blocks as children. The last child of a block
is normally considered **open**, meaning that subsequent lines of input
can alter its contents. (Blocks that are not open are **closed**.)
Here, for example, is a possible document tree, with the open blocks
marked by arrows:

\`\`\`tree
-> document
  -> block_quote
       paragraph
         "Lorem ipsum dolor\\nsit amet."
    -> list (type=bullet tight=true bullet_char=-)
         list_item
           paragraph
             "Qui *quodsi iracundia*"
      -> list_item
        -> paragraph
             "aliquando id"
\`\`\`

## Phase 1: block structure

Each line that is processed has an effect on this tree. The line is
analyzed and, depending on its contents, the document may be altered
in one or more of the following ways:

1. One or more open blocks may be closed.
2. One or more new blocks may be created as children of the
   last open block.
3. Text may be added to the last (deepest) open block remaining
   on the tree.

Once a line has been incorporated into the tree in this way,
it can be discarded, so input can be read in a stream.

For each line, we follow this procedure:

1. First we iterate through the open blocks, starting with the
   root document, and descending through last children down to the last
   open block. Each block imposes a condition that the line must satisfy
   if the block is to remain open. For example, a block quote requires a
   \`>\` character. A paragraph requires a non-blank line.
   In this phase we may match all or just some of the open
   blocks. But we cannot close unmatched blocks yet, because we may have a
   [lazy continuation line].

2. Next, after consuming the continuation markers for existing
   blocks, we look for new block starts (e.g. \`>\` for a block quote).
   If we encounter a new block start, we close any blocks unmatched
   in step 1 before creating the new block as a child of the last
   matched block.

3. Finally, we look at the remainder of the line (after block
   markers like \`>\`, list markers, and indentation have been consumed).
   This is text that can be incorporated into the last open
   block (a paragraph, code block, heading, or raw HTML).

Setext headings are formed when we see a line of a paragraph
that is a [setext heading underline].

Reference link definitions are detected when a paragraph is closed;
the accumulated text lines are parsed to see if they begin with
one or more reference link definitions. Any remainder becomes a
normal paragraph.

We can see how this works by considering how the tree above is
generated by four lines of Markdown:

\`\`\`markdown
> Lorem ipsum dolor
> sit amet.
>
> - Qui _quodsi iracundia_
> - aliquando id
\`\`\`

At the outset, our document model is just

\`\`\`tree
-> document
\`\`\`

The first line of our text,

\`\`\`markdown
> Lorem ipsum dolor
\`\`\`

causes a \`block_quote\` block to be created as a child of our
open \`document\` block, and a \`paragraph\` block as a child of
the \`block_quote\`. Then the text is added to the last open
block, the \`paragraph\`:

\`\`\`tree
-> document
  -> block_quote
    -> paragraph
         "Lorem ipsum dolor"
\`\`\`

The next line,

\`\`\`markdown
sit amet.
\`\`\`

is a "lazy continuation" of the open \`paragraph\`, so it gets added
to the paragraph's text:

\`\`\`tree
-> document
  -> block_quote
    -> paragraph
         "Lorem ipsum dolor\\nsit amet."
\`\`\`

The third line,

\`\`\`markdown
> - Qui _quodsi iracundia_
\`\`\`

causes the \`paragraph\` block to be closed, and a new \`list\` block
opened as a child of the \`block_quote\`. A \`list_item\` is also
added as a child of the \`list\`, and a \`paragraph\` as a child of
the \`list_item\`. The text is then added to the new \`paragraph\`:

\`\`\`tree
-> document
  -> block_quote
       paragraph
         "Lorem ipsum dolor\\nsit amet."
    -> list (type=bullet tight=true bullet_char=-)
      -> list_item
        -> paragraph
             "Qui *quodsi iracundia*"
\`\`\`

The fourth line,

\`\`\`markdown
> - aliquando id
\`\`\`

causes the \`list_item\` (and its child the \`paragraph\`) to be closed,
and a new \`list_item\` opened up as child of the \`list\`. A \`paragraph\`
is added as a child of the new \`list_item\`, to contain the text.
We thus obtain the final tree:

\`\`\`tree
-> document
  -> block_quote
       paragraph
         "Lorem ipsum dolor\\nsit amet."
    -> list (type=bullet tight=true bullet_char=-)
         list_item
           paragraph
             "Qui *quodsi iracundia*"
      -> list_item
        -> paragraph
             "aliquando id"
\`\`\`

## Phase 2: inline structure

Once all of the input has been parsed, all open blocks are closed.

We then "walk the tree," visiting every node, and parse raw
string contents of paragraphs and headings as inlines. At this
point we have seen all the link reference definitions, so we can
resolve reference links as we go.

\`\`\`tree
document
  block_quote
    paragraph
      str "Lorem ipsum dolor"
      softbreak
      str "sit amet."
    list (type=bullet tight=true bullet_char=-)
      list_item
        paragraph
          str "Qui "
          emph
            str "quodsi iracundia"
      list_item
        paragraph
          str "aliquando id"
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

- 如果找到了一个活动的，我们向前解析以查看是否有内联链接/图像、引用链接/图像、紧凑引用链接/图像或快捷引用链接/图像。
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
