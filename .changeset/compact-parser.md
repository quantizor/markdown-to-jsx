---
"markdown-to-jsx": minor
---

Parsing is 16% faster on average, and rendering to React, React Native, Solid, Vue, and HTML is 12% faster, on documents from a few words to 211 kB (Bun 1.4, Apple Silicon Mac mini, production builds). On Node 24, parsing is 27% faster and rendering to React, Solid, Vue, and HTML is 26% faster; in Chrome 157, the same figures are 16% and 14%. Bundles are 12% smaller gzipped for browsers and 18% smaller for Node.

Raw HTML is screened more strictly. A `<meta>` refresh to a script URL, a `style` that loads a script (even when disguised), a `srcdoc` written in braces, and an event handler written in braces on a tag listed in `overrides` no longer reach the page, though React, React Native, and Solid components still receive that handler as a prop. In React and React Native, an attribute name with a colon in it, other than an `xlink:`, `xml:`, or `xmlns:` name, stays as written, where `<a h:ref="javascript:…">` used to become a working `href`. Image addresses are percent-encoded like link addresses, and an SVG data URL works only as an image. If you render markdown written by someone else, please upgrade.

Parsing follows CommonMark and GFM more closely: highlight (`==`) needs a run of exactly two, as strikethrough does; a line missing its `>` or list indent continues a quote or list item only after a paragraph; a code span trims one space from each end only when both ends have one; a `]` inside an HTML element's content ends link text; lowercase `<!doctype html>` is raw HTML; and a bare email address may have `_` in its domain.

Heading ids now spell accented Latin letters as their plain letters, and `ß` as `ss`, so `# Öl Straße` gets `id="ol-strasse"` where it got `l-strae`, and `# Łódź` gets `lodz` where it got `od`. Update any link to such a heading's old id. A heading whose id would be empty, such as `# !!!`, gets no `id`.

React no longer throws on a code fence with a `style` attribute or on a `<textarea>` holding markup with `tagfilter` off, and React and React Native no longer throw on an attribute name ending in a colon (`<span a:="1">`).

A document that is only frontmatter is read as frontmatter, and React Native accepts `preserveFrontmatter`. Converting to markdown now keeps escaped text, adjacent emphasis, email addresses, and frontmatter as written when the output is parsed again.
