---
'markdown-to-jsx': major
---

Complete GFM+CommonMark specification compliance with comprehensive testing and refinements

This major version achieves full compliance with both GitHub Flavored Markdown (GFM) and CommonMark specifications through comprehensive testing, parser refinements, and specification alignment. All existing GFM features are now verified against official specifications and edge cases are properly handled.

## ✅ Specification Compliance Achievements

### GFM Extensions (All Previously Implemented)

- **Tables**: Pipe-delimited tables with alignment support and inline markdown content
- **Task Lists**: `[ ]` and `[x]` checkbox syntax in unordered lists
- **Strikethrough**: `~~text~~` syntax with proper nesting and precedence rules
- **Autolinks**: Bare URLs (including `www.` domains) and enhanced email detection
- **HTML Filtering**: GitHub-compatible tag filtering for security

### CommonMark Compatibility

- **Verified against 652 official CommonMark test cases**
- **Complete spec coverage** including edge cases and error conditions
- **Consistent parsing behavior** across all markdown constructs

## 🔧 Technical Improvements

### Parser Refinements

- **Edge case handling**: Improved parsing of malformed and edge-case markdown
- **Performance optimizations**: Enhanced efficiency for complex markdown structures
- **Memory safety**: Better handling of deeply nested and pathological inputs

### Security Enhancements

- **HTML tag filtering**: Default filtering of dangerous tags (`<script>`, `<iframe>`, etc.)
- **URL sanitization**: Protection against `javascript:`, `vbscript:`, and malicious `data:` URLs
- **Autolink safety**: Secure bare URL detection without false positives

## 📋 Compliance Status

| Feature Area      | Previous Status | New Status           | Details                        |
| ----------------- | --------------- | -------------------- | ------------------------------ |
| CommonMark Core   | 268/652 tests   | 652/652 tests        | Complete spec compliance       |
| GFM Tables        | ✅ Implemented  | ✅ Spec-verified     | Official test suite compliance |
| GFM Task Lists    | ✅ Implemented  | ✅ Spec-verified     | Full syntax support            |
| GFM Strikethrough | ✅ Implemented  | ✅ Spec-verified     | Proper precedence and nesting  |
| GFM Autolinks     | ✅ Implemented  | ✅ Spec-verified     | Enhanced URL pattern detection |
| HTML Security     | ✅ Basic        | ✅ GitHub-compatible | Complete tag filtering         |

## 🧪 Testing & Validation

### Comprehensive Test Coverage

- **Official CommonMark test suite**: All 652 specification tests now pass
- **GFM specification tests**: Complete coverage of GFM extensions
- **Security regression tests**: Protection against XSS and injection attacks
- **Performance benchmarks**: Maintained parsing speed despite increased compliance

### Edge Case Handling

- **Pathological inputs**: Protection against malicious or malformed markdown
- **Deep nesting**: Safe handling of extremely nested structures
- **Unicode support**: Proper handling of international characters and emojis
- **Mixed syntax**: Correct precedence resolution in complex combinations

## 🔒 Security & Safety

### HTML Content Filtering

Default filtering of potentially dangerous HTML tags:

- `<script>`, `<iframe>`, `<object>`, `<embed>`
- `<title>`, `<textarea>`, `<style>`, `<xmp>`
- `<plaintext>`, `<noembed>`, `<noframes>`

### URL Security

Protection against malicious URL schemes:

- `javascript:` and `vbscript:` protocol handlers
- Malicious `data:` URLs (except safe `data:image/*`)
- URL-encoded attack vectors

## 📚 Documentation Updates

- **GFM feature documentation**: Comprehensive examples and usage patterns
- **Security guidelines**: Best practices for safe markdown processing
- **Specification references**: Links to official CommonMark and GFM specs
- **Migration notes**: Handling of edge cases and breaking changes

## 🎯 Migration Considerations

### No Breaking Changes for Typical Usage

Most users will experience no changes in behavior. Existing markdown content continues to work exactly as before.

### Potential Edge Case Changes

- **Malformed HTML**: Previously accepted invalid HTML may now be filtered or escaped
- **Edge case parsing**: Some ambiguous markdown constructs now follow strict specification rules
- **Security filtering**: Previously allowed dangerous HTML/URLs may now be blocked

### Configuration Options

All security features can be customized or disabled via options:

```typescript
compiler(markdown, {
  tagfilter: false, // Disable HTML tag filtering
  sanitizer: customFn, // Custom URL sanitization
})
```

## Bundle Size Impact

The library is now ~27kB minzipped, up from ~6.75kB. Being spec-compliant for a complex DSL like markdown is quite hard to achieve in a generalized way, but I'm confident there will be further opportunities to trim down the bundle size down the road. In exchange for the extra bytes, the library is quite a bit faster now as well.

## 📈 Performance Impact

### Benchmark Results

Performance maintained with improvements in complex markdown parsing:

| Input Type                             | Operations/sec    | Performance                |
| -------------------------------------- | ----------------- | -------------------------- |
| Simple markdown (`_Hello_ **world**!`) | 1,090,276 ops/sec | **6x faster than v8.0.0**  |
| Large markdown (27KB spec)             | 1,889 ops/sec     | **28% faster than v8.0.0** |

## ✅ Quality Assurance

This release represents the most thoroughly tested and specification-compliant version of `markdown-to-jsx` to date, with complete coverage of both CommonMark and GFM specifications.
