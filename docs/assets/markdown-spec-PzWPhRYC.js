const n=`# Markdown 语法

- [概览 (Overview)](#overview)
  - [哲学 (Philosophy)](#philosophy)
  - [内联 HTML (Inline HTML)](#html)
  - [特殊字符的自动转义 (Automatic Escaping)](#autoescape)
- [块级元素 (Block Elements)](#block)
  - [段落和换行 (Paragraphs and Line Breaks)](#p)
  - [标题 (Headers)](#header)
  - [引用 (Blockquotes)](#blockquote)
  - [列表 (Lists)](#list)
  - [代码块 (Code Blocks)](#precode)
  - [分隔线 (Horizontal Rules)](#hr)
- [内联元素 (Span Elements)](#span)
  - [链接 (Links)](#link)
  - [强调 (Emphasis)](#em)
  - [代码 (Code)](#code)
  - [图像 (Images)](#img)
- [杂项 (Miscellaneous)](#misc)
  - [反斜杠转义 (Backslash Escapes)](#backslash)
  - [自动链接 (Automatic Links)](#autolink)

**注意：** 本文档本身是使用 Markdown 编写的；您可以[通过在 URL 后添加 '.text' 来查看其源文件][src]。

[src]: /projects/markdown/syntax.text

---

<h2 id="overview">概览 (Overview)</h2>

<h3 id="philosophy">哲学 (Philosophy)</h3>

Markdown 的目标是尽可能地易读和易写。

然而，可读性被强调为重中之重。Markdown 格式的文档应该能够以纯文本形式原样发布，而看起来不像被标记了标签或格式说明。虽然 Markdown 的语法受到了几种现有文本到 HTML 过滤器的影响——包括 [Setext] [1], [atx] [2], [Textile] [3], [reStructuredText] [4], [Grutatext] [5] 和 [EtText] [6]——但 Markdown 语法的最大灵感来源是纯文本电子邮件的格式。

[1]: http://docutils.sourceforge.net/mirror/setext.html
[2]: http://www.aaronsw.com/2002/atx/
[3]: http://textism.com/tools/textile/
[4]: http://docutils.sourceforge.net/rst.html
[5]: http://www.triptico.com/software/grutatxt.html
[6]: http://ettext.taint.org/doc/

为此，Markdown 的语法完全由标点符号组成，这些标点符号经过精心选择，使其看起来就像它们所代表的含义。例如，单词周围的星号实际上看起来像 \\*强调\\*。Markdown 列表看起来就像列表。如果你用过电子邮件，甚至连引用看起来都像引用的文字片段。

<h3 id="html">内联 HTML (Inline HTML)</h3>

Markdown 语法的目的是为了一个目标：用作一种为 Web 进行 _写作_ 的格式。

Markdown 不是 HTML 的替代品，甚至连接近都算不上。它的语法非常小，仅对应于 HTML 标签的一个非常小的子集。其理念 _不是_ 为了创建一个使插入 HTML 标签变得更容易的语法。在我看来，HTML 标签已经很容易插入了。Markdown 的理念是使其更容易阅读、编写和编辑散文。HTML 是一种 _发布_ 格式；Markdown 是一种 _写作_ 格式。因此，Markdown 的格式语法只解决那些可以用纯文本传达的问题。

对于任何 Markdown 语法未涵盖的标记，您只需直接使用 HTML 即可。无需加前缀或分隔符来指示您正在从 Markdown 切换到 HTML；您只需使用标签。

唯一的限制是，块级 HTML 元素——例如 \`<div>\`、\`<table>\`、\`<pre>\`、\`<p>\` 等——必须通过空行与周围内容分隔开，且块的开始和结束标签不应使用制表符或空格进行缩进。Markdown 足够聪明，不会在 HTML 块级标签周围添加额外的（不需要的）\`<p>\` 标签。

例如，要在 Markdown 文章中添加 HTML 表格：

    这是一个普通段落。

    <table>
        <tr>
            <td>示例</td>
        </tr>
    </table>

    这是另一个普通段落。

请注意，在块级 HTML 标签内不会处理 Markdown 格式语法。例如，您不能在 HTML 块内使用 Markdown 风格的 \`*强调*\`。

跨度级 (Span-level) HTML 标签——例如 \`<span>\`、\`<cite>\` 或 \`<del>\`——可以在 Markdown 段落、列表项或标题的任何地方使用。如果您愿意，甚至可以使用 HTML 标签来代替 Markdown 格式；例如，如果您更喜欢使用 HTML \`<a>\` 或 \`<img>\` 标签而不是 Markdown 的链接或图像语法，请随意使用。

与块级 HTML 标签不同，Markdown 语法 _会_ 在跨度级标签内进行处理。

<h3 id="autoescape">特殊字符的自动转义 (Automatic Escaping)</h3>

在 HTML 中，有两个字符需要特殊处理：\`<\` 和 \`&\`。左尖括号用于开始标签；和号用于表示 HTML 实体。如果您想将它们用作字面字符，必须将它们转义为实体，例如 \`&lt;\` 和 \`&amp;\`。

和号对于 Web 作家来说尤其令人头疼。如果您想写 'AT&T'，您需要写成 '\`AT&amp;T\`'。您甚至需要转义 URL 中的和号。因此，如果您想链接到：

    http://images.google.com/images?num=30&q=larry+bird

您需要将 URL 编码为：

    http://images.google.com/images?num=30&amp;q=larry+bird

在您的锚点标签 \`href\` 属性中。不用说，这很容易忘记，并且可能是本来标记良好的网站中 HTML 验证错误的最常见来源。

Markdown 允许您自然地使用这些字符，为您处理所有必要的转义。如果您将和号用作 HTML 实体的一部分，它将保持不变；否则它将被翻译成 \`&amp;\`。

因此，如果您想在文章中包含版权符号，您可以写：

    &copy;

Markdown 不会管它。但是如果您写：

    AT&T

Markdown 会将其翻译为：

    AT&amp;T

同样，因为 Markdown 支持 [内联 HTML](#html)，如果您使用尖括号作为 HTML 标签的定界符，Markdown 会这样对待它们。但是如果您写：

    4 < 5

Markdown 会将其翻译为：

    4 &lt; 5

但是，在 Markdown 代码跨度和代码块内，尖括号和和号 _总是_ 自动编码。这使得使用 Markdown 编写 HTML 代码变得容易。（相对于原始 HTML，这是一种编写 HTML 语法的糟糕格式，因为示例代码中的每一个 \`<\` 和 \`&\` 都需要转义。）

---

<h2 id="block">块级元素 (Block Elements)</h2>

<h3 id="p">段落和换行 (Paragraphs and Line Breaks)</h3>

一个段落简单地由一行或多行连续的文本组成，通过一个或多个空行进行分隔。（空行是指任何看起来像空行的行——只包含空格或制表符的行也被视为空行。）普通段落不应使用空格或制表符进行缩进。

“一行或多行连续文本”规则的含义是 Markdown 支持“硬换行”的文本段落。这与大多数其他文本到 HTML 格式化程序（包括 Movable Type 的“转换换行符”选项）有显著不同，后者会将段落中的每个换行符都转换为 \`<br />\` 标签。

当您 _确实_ 想使用 Markdown 插入 \`<br />\` 换行标签时，请在行尾添加两个或更多空格，然后按回车。

是的，这需要稍多一点的努力来创建 \`<br />\`，但对于 Markdown 来说，简单的“每个换行符都是一个 \`<br />\`”规则并不适用。Markdown 风格的 [引用][bq] 和多段落 [列表项][l] 在使用硬换行进行格式化时效果最好——也看起来更漂亮。

[bq]: #blockquote
[l]: #list

<h3 id="header">标题 (Headers)</h3>

Markdown 支持两种风格的标题：[Setext] [1] 和 [atx] [2]。

Setext 风格的标题使用等号（用于一级标题）和连字符（用于二级标题）进行“下划线”。例如：

    这是一个 H1
    =============

    这是一个 H2
    -------------

任意数量的 \`=\` 或 \`-\` 都可以。

Atx 风格的标题在行首使用 1-6 个井号，对应于 1-6 级标题。例如：

    # 这是一个 H1

    ## 这是一个 H2

    ###### 这是一个 H6

（可选）您可以“关闭”atx 风格的标题。这纯粹是装饰性的——如果您觉得这样看起来更好看，可以使用。结尾的井号甚至不需要与开头的井号数量匹配。（井号的数量决定了标题级别）：

    # 这是一个 H1 #

    ## 这是一个 H2 ##

    ### 这是一个 H3 ######

<h3 id="blockquote">引用 (Blockquotes)</h3>

Markdown 使用电子邮件风格的 \`>\` 字符进行引用。如果您熟悉在电子邮件消息中引用文本段落，那么您就知道如何在 Markdown 中创建引用。如果您对文本进行硬换行并在每一行前放一个 \`>\`，效果最好：

    > 这是一个包含两个段落的引用。这是第一段的内容示例，
    > 用于演示引用的格式。这段文字展示了如何在 Markdown 中创建引用块。
    > 引用块可以包含多行文本，每行都以大于号开头。
    >
    > Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse
    > id sem consectetuer libero luctus adipiscing.

Markdown 允许你“偷懒”，只在硬换行段落的第一行前面放 \`>\`：

    > 这是一个包含两个段落的引用。这是第一段的内容示例，
    用于演示引用的格式。这段文字展示了如何在 Markdown 中创建引用块。
    引用块可以包含多行文本，每行都以大于号开头。

    > Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse
    id sem consectetuer libero luctus adipiscing.

引用可以嵌套（即引用中的引用），只需添加额外级别的 \`>\`：

    > 这是第一级引用。
    >
    > > 这是嵌套引用。
    >
    > 回到第一级。

引用可以包含其他 Markdown 元素，包括标题、列表和代码块：

    > ## 这是一个标题。
    >
    > 1.   这是第一个列表项。
    > 2.   这是第二个列表项。
    >
    > 这是一个代码示例：
    >
    >     return shell_exec("echo $input | $markdown_script");

任何体面的文本编辑器都应该使电子邮件风格的引用变得容易。例如，在 BBEdit 中，您可以进行选择并从“文本 (Text)”菜单中选择“增加引用级别 (Increase Quote Level)”。

<h3 id="list">列表 (Lists)</h3>

Markdown 支持有序（数字）列表和无序（项目符号）列表。

无序列表使用星号、加号和连字符——它们可以互换使用——作为列表标记：

    *   红
    *   绿
    *   蓝

等同于：

    +   红
    +   绿
    +   蓝

以及：

    -   红
    -   绿
    -   蓝

有序列表使用数字后跟句点：

    1.  红色
    2.  绿色
    3.  蓝色

重要提示：您用于标记列表的实际数字对 Markdown 生成的 HTML 输出没有影响。Markdown 从上述列表生成的 HTML 为：

    <ol>
    <li>红色</li>
    <li>绿色</li>
    <li>蓝色</li>
    </ol>

如果您在 Markdown 中像这样编写列表：

    1.  红色
    1.  绿色
    1.  蓝色

甚至：

    3. 红色
    1. 绿色
    8. 蓝色

您将得到完全相同的 HTML 输出。重点是，如果您愿意，您可以在有序 Markdown 列表中使用序号，以便源码中的数字与发布的 HTML 中的数字相匹配。但如果您想偷懒，也可以不必这样做。

但是，如果您确实使用“懒惰”的列表编号，您仍然应该从数字 1 开始。在未来的某个时刻，Markdown 可能会支持从任意数字开始有序列表。

列表标记通常从左边距开始，但最多可以缩进三个空格。列表标记后面必须跟着一个或多个空格或一个制表符。

为了使列表看起来美观，您可以使用悬挂缩进包装项目：

    *   这是第一个列表项的内容。这段文字比较长，
        需要换行显示。使用悬挂缩进可以使列表更加美观，
        提高可读性。
    *   这是第二个列表项。同样使用了悬挂缩进来格式化
        较长的文本内容。

但如果您想偷懒，也可以不必这样做：

    *   这是第一个列表项的内容。这段文字比较长，
    需要换行显示。使用悬挂缩进可以使列表更加美观，
    提高可读性。
    *   这是第二个列表项。同样使用了悬挂缩进来格式化
    较长的文本内容。

如果列表项之间有空行，Markdown 将在 HTML 输出中将这些项包装在 \`<p>\` 标签中。例如，这个输入：

    *   苹果
    *   香蕉

将变为：

    <ul>
    <li>苹果</li>
    <li>香蕉</li>
    </ul>

但这个：

    *   苹果

    *   香蕉

将变为：

    <ul>
    <li><p>苹果</p></li>
    <li><p>香蕉</p></li>
    </ul>

列表项可能由多个段落组成。列表项中的每个后续段落必须缩进 4 个空格或一个制表符：

    1.  这是一个包含两个段落的列表项。这是第一段的内容，
        用于演示如何在列表项中包含多个段落。
        需要适当的缩进。

        这是同一列表项中的第二段。注意它缩进了 4 个空格
        或一个制表符。这样 Markdown 就知道这段文字
        属于同一个列表项。

    2.  这是列表中的第二个项目。

如果您缩进后续段落的每一行，看起来会很美观，但同样，Markdown 允许您偷懒：

    *   这是一个包含两个段落的列表项。

        这是列表项中的第二个段落。您
    只需要缩进第一行。后续的行可以不缩进，
    Markdown 也能正确识别。

    *   同一列表中的另一个项目。

要在列表项中放入引用，引用的 \`>\` 分隔符需要缩进：

    *   带有引用的列表项：

        > 这是一个在列表项
        > 内部的引用。

要在列表项中放入代码块，代码块需要缩进 _两次_ —— 8 个空格或两个制表符：

    *   带有代码块的列表项：

            <此处为代码>

值得注意的是，如果不小心，可能会触发有序列表，例如编写如下内容：

    1986. 这是一个伟大的赛季。

换句话说，行首出现了 _数字-句点-空格_ 序列。为了避免这种情况，您可以对句点进行反斜杠转义：

    1986\\. 这是一个伟大的赛季。

<h3 id="precode">代码块 (Code Blocks)</h3>

预格式化的代码块用于编写关于编程或标记源码的内容。代码块的行不是形成普通段落，而是被按字面意思解释。Markdown 将代码块包装在 \`<pre>\` 和 \`<code>\` 标签中。

要在 Markdown 中生成代码块，只需将块的每一行缩进至少 4 个空格或 1 个制表符。例如，给定此输入：

    这是一个普通段落：

        这是一个代码块。

Markdown 将生成：

    <p>这是一个普通段落：</p>

    <pre><code>这是一个代码块。
    </code></pre>

代码块的每一行都会移除一级缩进（4 个空格或 1 个制表符）。例如，这个：

    这是一个 AppleScript 的示例：

        tell application "音乐"
            beep
        end tell

将变为：

    <p>这是一个 AppleScript 的示例：</p>

    <pre><code>tell application "音乐"
        beep
    end tell
    </code></pre>

代码块会一直持续，直到遇到没有缩进的行（或文章结束）。

在代码块内部，和号 (\`&\`) 和尖括号 (\`<\` 和 \`>\`) 会自动转换为 HTML 实体。这使得使用 Markdown 包含 HTML 源码示例变得非常容易——只需粘贴并缩进它，Markdown 就会处理编码和号和尖括号的麻烦。例如，这个：

        <div class="footer">
            &copy; 2004 示例公司
        </div>

将变为：

    <pre><code>&lt;div class="footer"&gt;
        &amp;copy; 2004 示例公司
    &lt;/div&gt;
    </code></pre>

普通 Markdown 语法在代码块内不会被处理。例如，星号在代码块内只是字面意思上的星号。这意味着使用 Markdown 编写关于 Markdown 自身语法的内容也很容易。

<h3 id="hr">分隔线 (Horizontal Rules)</h3>

您可以通过在一行中单独放置三个或更多连字符、星号或下划线来生成水平分隔线标签 (\`<hr />\`)。如果您愿意，可以在连字符或星号之间使用空格。以下每一行都会生成一条水平线：

    * * *

    ***

    *****

    - - -

    ---------------------------------------

---

<h2 id="span">内联元素 (Span Elements)</h2>

<h3 id="link">链接 (Links)</h3>

Markdown 支持两种风格的链接：_内联 (Inline)_ 和 _引用 (Reference)_。

在这两种风格中，链接文本均由 [方括号] 定界。

要创建内联链接，请在链接文本的闭方括号后紧跟一组常规圆括号。在圆括号内，放入您希望链接指向的 URL，以及链接的 _可选_ 标题，标题需用引号括起来。例如：

    这是一个 [示例](http://example.com/ "标题") 内联链接。

    [此链接](http://example.net/) 没有标题属性。

将生成：

    <p>这是一个 <a href="http://example.com/" title="标题">
    示例</a> 内联链接。</p>

    <p><a href="http://example.net/">此链接</a> 没有
    标题属性。</p>

如果您指的是同一服务器上的本地资源，可以使用相对路径：

    有关详情，请参阅我的 [关于](/about/) 页面。

引用式链接使用第二组方括号，在其中放入您选择的标签以标识链接：

    这是一个 [示例][id] 引用式链接。

您可以选择使用空格分隔这组方括号：

    这是一个 [示例] [id] 引用式链接。

然后，在文档的任何位置，您可以像这样单独在一行定义链接标签：

    [id]: http://example.com/  "此处为可选标题"

即：

- 包含链接标识符的方括号（可选择从左边距缩进最多三个空格）；
- 后跟一个冒号；
- 后跟一个或多个空格（或制表符）；
- 后跟链接的 URL；
- 可选地后跟链接的标题属性，用双引号、单引号或圆括号括起来。

以下三个链接定义是等效的：

    [foo]: http://example.com/  "此处为可选标题"
    [foo]: http://example.com/  '此处为可选标题'
    [foo]: http://example.com/  (此处为可选标题)

**注意：** Markdown.pl 1.0.1 中存在一个已知错误，该错误阻止使用单引号来定界链接标题。

链接 URL 可以选择性地用尖括号括起来：

    [id]: <http://example.com/>  "此处为可选标题"

您可以将标题属性放在下一行，并使用额外的空格或制表符进行填充，这在处理较长的 URL 时往往看起来更好：

    [id]: http://example.com/longish/path/to/resource/here
        "此处为可选标题"

链接定义仅在 Markdown 处理期间用于创建链接，并在 HTML 输出中从您的文档中剥离。

链接定义名称可以包含字母、数字、空格和标点符号——但它们 _不_ 区分大小写。例如，这两个链接：

    [link text][a]
    [link text][A]

是等效的。

_隐式链接名称 (Implicit link name)_ 快捷方式允许您省略链接名称，在这种情况下，链接文本本身被用作名称。只需使用一组空的方括号即可——例如，要将单词 "Google" 链接到 google.com 网站，您可以简单地写：

    [Google][]

然后定义链接：

    [Google]: http://google.com/

因为链接名称可以包含空格，所以此快捷方式甚至适用于链接文本中的多个单词：

    访问 [Daring Fireball][] 获取更多信息。

然后定义链接：

    [Daring Fireball]: http://daringfireball.net/

链接定义可以放置在 Markdown 文档的任何位置。我倾向于将它们放在使用它们的每个段落之后，但如果您愿意，也可以将它们全部放在文档末尾，有点像脚注。

这是一个引用链接的实际示例：

    我从 [Google] [1] 获得的流量是来自 [Yahoo] [2] 或 [MSN] [3] 的 10 倍。

      [1]: http://google.com/        "Google"
      [2]: http://search.yahoo.com/  "Yahoo Search"
      [3]: http://search.msn.com/    "MSN Search"

使用隐式链接名称快捷方式，您可以改写为：

    我从 [Google][] 获得的流量是来自 [Yahoo][] 或 [MSN][] 的 10 倍。

      [google]: http://google.com/        "Google"
      [yahoo]:  http://search.yahoo.com/  "Yahoo Search"
      [msn]:    http://search.msn.com/    "MSN Search"

上述两个示例都将生成以下 HTML 输出：

    <p>我从 <a href="http://google.com/"
    title="Google">Google</a> 获得的流量是来自
    <a href="http://search.yahoo.com/" title="Yahoo Search">Yahoo</a>
    或 <a href="http://search.msn.com/" title="MSN Search">MSN</a> 的 10 倍。</p>

为了进行比较，这里是使用 Markdown 的内联链接风格编写的相同段落：

    我从 [Google](http://google.com/ "Google") 获得的流量是来自
    [Yahoo](http://search.yahoo.com/ "Yahoo Search") 或
    [MSN](http://search.msn.com/ "MSN Search") 的 10 倍。

引用式链接的重点不在于它们更容易编写。重点在于使用引用式链接，您的文档源码的可读性大大提高。比较上述示例：使用引用式链接，段落本身只有 81 个字符长；使用内联式链接，它是 176 个字符；而作为原始 HTML，它是 234 个字符。在原始 HTML 中，标记比文本还多。

使用 Markdown 的引用式链接，源文档更接近于最终输出，就像在浏览器中渲染的一样。通过允许您将与标记相关的元数据移出段落，您可以添加链接而不会中断散文的叙述流程。

<h3 id="em">强调 (Emphasis)</h3>

Markdown 将星号 (\`*\`) 和下划线 (\`_\`) 视为强调的指示符。用一个 \`*\` 或 \`_\` 包裹的文本将被包装在 HTML \`<em>\` 标签中；双 \`*\` 或 \`_\` 将被包装在 HTML \`<strong>\` 标签中。例如，此输入：

    *单个星号*

    _单个下划线_

    **双星号**

    __双下划线__

将生成：

    <em>单个星号</em>

    <em>单个下划线</em>

    <strong>双星号</strong>

    <strong>双下划线</strong>

您可以使用任何您喜欢的风格；唯一的限制是必须使用相同的字符来打开和关闭强调跨度。

强调可以在单词中间使用：

    un*frigging*believable

但如果您用空格包围 \`*\` 或 \`_\`，它将被视为字面意思上的星号或下划线。

要在原本会被用作强调定界符的位置生成字面意思上的星号或下划线，您可以对其进行反斜杠转义：

    \\*这段文本被字面意思上的星号包围\\*

<h3 id="code">代码 (Code)</h3>

要指示一段代码跨度，请用反引号将其包裹 (\`\` \` \`\`)。与预格式化的代码块不同，代码跨度表示正常段落中的代码。例如：

    使用 \`printf()\` 函数。

将生成：

    <p>使用 <code>printf()</code> 函数。</p>

要在代码跨度内包含字面意思的反引号字符，您可以使用多个反引号作为打开和关闭定界符：

    \`\`这里有一个字面意思的反引号 (\`)。\`\`

这将生成：

    <p><code>这里有一个字面意思的反引号 (\`)。</code></p>

包围代码跨度的反引号定界符可以包含空格——在打开的反引号之后一个，在关闭的反引号之前一个。这允许您在代码跨度的开头或结尾放置字面意思的反引号字符：

    代码跨度中的单个反引号：\`\` \` \`\`

    代码跨度中由反引号定界的字符串：\`\` \`foo\` \`\`

将生成：

    <p>代码跨度中的单个反引号：<code>\`</code></p>

    <p>代码跨度中由反引号定界的字符串：<code>\`foo\`</code></p>

在代码跨度中，和号和尖括号会自动编码为 HTML 实体，这使得包含 HTML 标签示例变得容易。Markdown 将把这个：

    请不要使用任何 \`<blink>\` 标签。

转为：

    <p>请不要使用任何 <code>&lt;blink&gt;</code> 标签。</p>

您可以这样写：

    \`&#8212;\` 是 \`&mdash;\` 的十进制编码等价值。

生成：

    <p><code>&amp;#8212;</code> 是 <code>&amp;mdash;</code> 的十进制编码等价值。</p>

<h3 id="img">图像 (Images)</h3>

不可否认，要为纯文本文件格式设计一种“自然”的图像放置语法是相当困难的。

Markdown 使用一种旨在模仿链接语法的图像语法，允许两种风格：_内联_ 和 _引用_。

内联图像语法如下所示：

    ![Alt 文本](/path/to/img.jpg)

    ![Alt 文本](/path/to/img.jpg "可选标题")

即：

- 一个感叹号：\`!\`;
- 后跟一组方括号，其中包含图像的 \`alt\` 属性文本；
- 后跟一组圆括号，其中包含图像的 URL 或路径，以及一个用双引号或单引号括起来的可选 \`title\` 属性。

引用式图像语法如下所示：

    ![Alt 文本][id]

其中 "id" 是定义的图像引用的名称。图像定义使用的语法与链接定义完全相同：

    [id]: url/to/image  "可选标题属性"

截至目前，Markdown 还没有指定图像尺寸的语法；如果这对您很重要，您可以简单地使用常规的 HTML \`<img>\` 标签。

---

<h2 id="misc">杂项 (Miscellaneous)</h2>

<h3 id="autolink">自动链接 (Automatic Links)</h3>

Markdown 支持一种为 URL 和电子邮件地址创建“自动”链接的快捷方式风格：只需用尖括号包裹 URL 或电子邮件地址即可。这意味着，如果您想显示 URL 或电子邮件地址的实际文本，并使其成为可点击的链接，您可以这样做：

    <http://example.com/>

Markdown 将其转为：

    <a href="http://example.com/">http://example.com/</a>

电子邮件地址的自动链接工作原理类似，不同之处在于 Markdown 还会执行一些随机的十进制和十六进制实体编码，以帮助防止地址抓取垃圾邮件机器人获取您的地址。例如，Markdown 将把这个：

    <address@example.com>

转为类似这样的内容：

    <a href="&#x6D;&#x61;i&#x6C;&#x74;&#x6F;:&#x61;&#x64;&#x64;&#x72;&#x65;
    &#115;&#115;&#64;&#101;&#120;&#x61;&#109;&#x70;&#x6C;e&#x2E;&#99;&#111;
    &#109;">&#x61;&#x64;&#x64;&#x72;&#x65;&#115;&#115;&#64;&#101;&#120;&#x61;
    &#109;&#x70;&#x6C;e&#x2E;&#99;&#111;&#109;</a>

这将在浏览器中渲染为一个指向 "address@example.com" 的可点击链接。

（这种实体编码技巧确实可以愚弄许多，甚至大多数地址抓取机器人，但它肯定无法愚弄所有人。聊胜于无，但以这种方式发布的地址最终可能还是会收到垃圾邮件。）

<h3 id="backslash">反斜杠转义 (Backslash Escapes)</h3>

Markdown 允许您使用反斜杠转义来生成那些在 Markdown 格式语法中具有特殊含义的字面意思字符。例如，如果您想用字面意思的星号包围一个单词（而不是 HTML 的 \`<em>\` 标签），您可以在星号前使用反斜杠，如下所示：

    \\*字面意思的星号\\*

Markdown 为以下字符提供反斜杠转义：

    \\   反斜杠
    \`   反引号
    *   星号
    _   下划线
    {}  花括号
    []  方括号
    ()  圆括号
    #   井号
    +	加号
    -	减号（连字符）
    .   句点
    !   感叹号
`;export{n as default};
