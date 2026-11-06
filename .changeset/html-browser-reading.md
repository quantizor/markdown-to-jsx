---
"markdown-to-jsx": patch
---

Raw HTML is now checked the way a browser reads it. If you render markdown written by someone else, please upgrade.

Markup that a browser reads differently from this library could reach the HTML output with a live event handler or link, and the markdown output could hand the next renderer a live tag or link. Solid and Vue could put `innerHTML` straight into the page, and Solid's `attr:`, `prop:`, and `bool:` prefixes could carry a handler past the check. Several inputs crashed or stopped rendering in React, React Native, Solid, and Vue. Deeply nested HTML, repeated `<pre></pre>` blocks, and long runs of unfinished HTML comments could slow rendering to tens of seconds; they now stay fast.

These attributes are now removed, because they can run script:

- `ref`, `innerHTML`, `outerHTML`, and `dangerouslySetInnerHTML` written in markdown, on every tag. `children` too, unless it becomes the element's content (see below).
- A `{…}` event handler on a hyphenated tag, such as `<my-widget onclick={…}>`, unless `overrides` lists the tag or `evalUnserializableExpressions` is on.
- A `{…}` event handler on a capitalized tag, such as `<Btn onClick={go}>`, in the HTML and markdown output and on the elements Solid and Vue create for it, with the same two exceptions. React, React Native, and `parser()` keep it as a prop, so a component you supply through `createElement` or `renderRule` still receives it.
- The `attributeName` of an SVG `<animate>` or `<set>` that changes a link or an event handler, so it stops animating. Animating any other attribute works as before.

Output that changes in every format:

- A `children` attribute becomes the element's text content, the way React reads it, on a tag `overrides` lists (or on a capitalized or hyphenated tag with `evalUnserializableExpressions` on). With `card` renamed to `i`, `<Card children="z" />` renders `<i>z</i>` in every output and every casing. The element's own content wins, so `<Card children="z">own</Card>` renders `<i>own</i>`. A void element such as `<img>` takes none, an object or array value is removed, and no output writes `children` as an attribute. Vue and the HTML and markdown output used to write it as an attribute, which shows nothing.
- A footnote reference with no definition, such as `[^1]`, stays as text, as GitHub shows it, rather than a superscript linking to nothing. If you render part of a document on its own, a reference whose definition is in another part shows as text. With `optimizeForStreaming`, a reference stays one while its definition may still arrive, and one at the very end of the text so far shows as `^1`.
- With a definition for `[^1]`, `[x][^1]` renders as `[x]` followed by the footnote reference, not as a link.
- A URL that mentions a dangerous scheme after its first `/`, `?`, or `#`, such as `https://en.wikipedia.org/wiki/Javascript:_The_Good_Parts`, is kept, and `sanitizer()` returns it where it returned `null`. `sanitizer()` now rejects a scheme split by a tab or line break.
- An opening tag that a browser reads but this library can't check safely, or one left unfinished at the end of a block of raw HTML, shows as text. In the HTML and markdown output, a long attribute value holding what looks like an unfinished tag is removed, or its tag shows as text.
- In a list item, a line with no indent after a finished block of raw HTML is read the way CommonMark reads it, so a footnote definition there now works.
- A link reference definition's URL ends at whitespace even after a backslash, as CommonMark says: `[r]: a\` with `b` on the next line keeps `b` as text.
- An entity in `<pre>` text, such as `<pre>a &lt; b</pre>`, shows as `a < b` in React, React Native, Solid, and Vue.
- `<pre><b>x</b></pre>` renders its markup in Solid and Vue rather than `[object Object]`.
- `<?php … ?>`, `<!DOCTYPE html>`, and `<![CDATA[…]]>` render nothing in React, React Native, Solid, and Vue, as in a browser. React crashed on them.

The markdown output is held to the same bar, because another renderer reads it. The rendered result stays the same, but the written text can change:

- Code that another renderer could read as a tag or link is written as `<code>` or `<pre><code>` HTML with entities rather than backticks or a fence. An unfinished tag counts, so a loop condition like `i<n` is written this way. A browser shows the same characters, and a language name stays as `class="language-html"`. Code that only names a tag such as `<script>` or `<style>` keeps its fence, unless `disableParsingRawHTML` is on.
- Text that looks like a tag, such as `\<b>` or `&lt;b>`, is written with `&lt;`. Quotes and brackets in image alt text, an empty `~~~~`, and characters such as `<` and `[` in footnote names, reference names, and link titles are escaped or written as entities.
- Text that reads like an entity after decoding, such as `&amp;copy;`, stays `&amp;copy;` rather than becoming `©`.
- A link target with a space or an angle bracket is percent-encoded, so `[x](<a b>)` is written `[x](a%20b)`. One with an unpaired parenthesis keeps its angle brackets, and a backslash that would read as an escape is doubled.
- `[^1]:` is written `[^1]\:`, and a `(` right after a `]` in text is written `\(`.
- A heading with a `=` or `-` underline keeps every line of its text, and one ending in a space and `#` keeps the `#`, written `\#`. A table cell keeps its backslashes and escaped pipes.
- Continuation lines in an ordered list indent to the width of the marker, three columns for `1.`, so a code block there no longer gains a space each time it is written.
- In a list item, a code block after raw HTML gets a blank line before it, which makes the list loose, and a raw opening tag spanning several lines is written on one line. A line break in a quoted value becomes `&#10;`, and one inside a `{…}` value becomes a space, which changes a multi-line string there.
- A tag inside `<?…?>` or `<![CDATA[…]]>`, past its first `>`, is written with `&lt;`. An unfinished HTML comment past the first line of raw HTML is written as text.
- A byte order mark at the start of text, and a U+2028 or U+2029 line separator right before a `>` in raw HTML, are written as entities.
- What a rename in `overrides` writes is read again like any other markdown, so `<span>y</span><b>z</b>` with `span` renamed to `div` gets a blank line after `</div>`, the same as writing `<div>` directly.

In the HTML output, `<script>`, `<iframe>`, and the other filtered tag names are written with `&lt;` inside comments and attribute values too, and every `&` in a link target is written `&amp;`, as React, Solid, and Vue already do. The page looks the same, except CDATA inside SVG or MathML shows the `&lt;`.
