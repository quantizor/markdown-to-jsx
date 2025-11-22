---
'markdown-to-jsx': major
---

Complete GFM+CommonMark specification compliance

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
