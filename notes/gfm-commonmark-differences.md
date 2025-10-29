# GFM vs CommonMark Differences

GFM (GitHub Flavored Markdown) is a strict superset of CommonMark. All CommonMark features are supported, with additional extensions documented below.

## Block-Level Extensions

### 1. Tables (Section 4.10)

**Syntax:**

- Pipe-delimited cells (`|`)
- Header row required (first line)
- Separator row with `-` and optional `:` for alignment
- Cells can contain inline markdown

**Example:**

```markdown
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
```

**Parsing:**

- Tables are detected when a line starts with `|` (after 0-3 spaces of indentation)
- Must have at least one header row
- Separator row determines column count and alignment
- Table ends at blank line or end of container

### 2. Task List Items (Section 5.3)

**Syntax:**

- Unordered list items can start with `[ ]` (unchecked) or `[x]` (checked)
- Case-insensitive: `[X]` also counts as checked
- Space between brackets required

**Example:**

```markdown
- [ ] Unchecked task
- [x] Checked task
- [x] Also checked
```

**Parsing:**

- Extension of list item parsing
- Task marker must be at the start of the list item content
- Task marker is part of the list item, not separate inline

## Inline-Level Extensions

### 3. Strikethrough (Section 6.5)

**Syntax:**

- Double tildes: `~~text~~`
- Cannot be nested
- Cannot span line breaks
- Same precedence rules as emphasis

**Example:**

```markdown
~~strikethrough text~~
```

**Parsing:**

- Uses delimiter stack similar to emphasis
- Requires exactly two `~` characters on each side
- Cannot be combined with emphasis delimiters

### 4. Autolinks Extension (Section 6.9)

**Enhanced autolink patterns beyond CommonMark:**

**CommonMark autolinks:**

- `<http://example.com>`
- `<https://example.com>`
- `<ftp://example.com>`
- `<mailto:user@example.com>`
- `<user@example.com>` (email)

**GFM additional patterns:**

- `www.` URLs (without protocol)
- Additional URL patterns recognized without angle brackets in some contexts

**Note:** The exact GFM autolink behavior may differ from CommonMark in edge cases and additional recognized patterns.

### 5. Disallowed Raw HTML (Section 6.11)

**Security extension:**

- Certain HTML tags are disallowed in GFM
- Tags like `<script>`, `<iframe>`, and other potentially dangerous tags are filtered
- This is a GitHub-specific security measure applied post-parsing

**Note:** This is typically handled in a sanitization phase after parsing, not during the core parsing phase.

## Summary

| Feature            | CommonMark | GFM      | Type                     |
| ------------------ | ---------- | -------- | ------------------------ |
| Tables             | No         | Yes      | Block extension          |
| Task lists         | No         | Yes      | List item extension      |
| Strikethrough      | No         | Yes      | Inline extension         |
| Enhanced autolinks | Limited    | Extended | Inline extension         |
| Disallowed HTML    | No         | Yes      | Security/post-processing |

All other CommonMark features (headings, lists, code blocks, emphasis, links, images, etc.) work identically in GFM.
