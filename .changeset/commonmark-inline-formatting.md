---
'markdown-to-jsx': major
---

Adopt CommonMark-compliant inline formatting parsing

**BREAKING CHANGE**: Inline formatting delimiters (emphasis, bold, strikethrough, mark) can no longer span across newlines, per CommonMark specification.

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

Renders as:

```html
<p>_Hello World._</p>
```

**Impact:**

- Single-line formatting still works: `*Hello World*` → `<em>Hello World</em>`
- Multi-line formatting is now rejected: `*Hello\nWorld*` → literal asterisks
- Affects all inline formatting: `*emphasis*`, `**bold**`, `~~strikethrough~~`, `==mark==`
- Improves CommonMark compliance (passes 269/652 tests, up from 268)

**Migration:**

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

This change aligns the library with the [CommonMark 0.31.2 specification](https://spec.commonmark.org/0.31/), improving compatibility with other CommonMark-compliant parsers and tools.
