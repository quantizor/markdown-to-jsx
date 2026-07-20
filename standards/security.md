Security standards

Depth behind the security rules in AGENTS.md. This library's entire input surface is untrusted by definition: a markdown parser exists to render text somebody else wrote. Every parsing and rendering path is a user-input surface and gets screened accordingly.

Threat model

The output of this library is placed directly into a live DOM (JSX renderers) or into a document that will be (the html and markdown string compilers). An attacker controls the full markdown source, including any raw HTML embedded in it, and may also control link targets, image sources, and JSX prop values. They cannot control the options object, the override map, or the code around the call.

Consequences of that model:

- Sanitization is on by default and independent of any caller-supplied option. A caller who never reads the docs still gets a safe result.
- The string compilers (html, markdown) are held to the same bar as the JSX ones. Their output is more dangerous, not less, because it lands in a sink with no framework escaping underneath it.
- A defense that only holds for well-formed input is not a defense. Assume malformed encodings, truncated tags, and interleaved control characters.

URL sanitization

Blocked schemes are `javascript:`, `vbscript:`, and `data:` other than `data:image`. The single regex is `/(javascript|vbscript|data(?!:image)):/i`.

Matching the literal scheme is not sufficient, and this is the mistake nearly every hand-rolled sanitizer makes. `java%73cript:alert(1)` and `%6a%61%76%61%73%63%72%69%70%74:...` both pass a literal test, and the browser executes them anyway because it decodes the attribute before acting on it. The working algorithm:

1. Run the scheme regex on the raw input. Reject on a match.
2. If the input contains no `%` it cannot be percent-encoded, so return it unchanged. This is the fast path and it keeps the decode cost off the common case.
3. Otherwise `decodeURIComponent(input)`, strip everything outside `[A-Za-z0-9/:]` from the decoded string, and re-run the scheme regex on the stripped result. Stripping before the second test collapses interleaved tricks like `java\tscript:` and `java\nscript:` down to the bare scheme.
4. `decodeURIComponent` throws on a malformed sequence such as a lone `%`. Catch it and reject the URL rather than passing it through.

One decode pass is the right depth. Browsers decode a URL attribute once, so defending against one decode matches the threat; decoding until stable would over-reject legitimate URLs containing a literal `%xx` in their path.

The return type is `string | null`, where `null` means "unsafe, do not render". Callers drop the attribute entirely rather than emitting a broken or dangerous one. In JSX the prop becomes `undefined` and is omitted, never the attacker's string.

`data:image` is deliberately allowed because inline images are a legitimate low-risk use. `data:image/svg+xml` is the known soft spot: it passes the filter and can execute script when opened as a top-level navigation. That tradeoff is documented for consumers in the README and tracked in BACKLOG.md rather than silently narrowed, because blocking it would also block safe inline SVG.

Raw HTML attributes

Independent of the URL sanitizer, raw HTML attributes are screened as the parser builds element nodes:

- Any `on*` attribute with a string value is removed, case-insensitively. A bare boolean `on*` on a component-like tag (`<MyComponent onClick />`) is a prop set to true rather than an inline handler, so it is kept.
- `srcdoc` on an iframe is removed.
- URL-bearing attributes (`href`, `src`, `action`, `formaction`, `poster`, `cite`, `background`, `data`, `longdesc`, `xlink:href`) are removed when the value resolves to a dangerous scheme, using the same decode-aware check above so entity-obfuscated schemes are caught.
- A JSX brace expression on a component-like tag is a prop the renderer resolves, not a raw-HTML handler string, so it is kept. On a standard HTML tag it is screened like any other value.

Dangerous tag names (`script`, `iframe`, `style`, `title`, `textarea`, `xmp`, `noembed`, `noframes`, `plaintext`) are escaped separately by the `tagfilter` option, which defaults to on.

Evaluation is opt-in and stays opt-in

JSX prop expressions that cannot be serialized (functions, free variables) are kept as strings by default. `evalUnserializableExpressions` turns on `eval()` for them and must never become the default, never be enabled by another option as a side effect, and never be presented in documentation without the untrusted-input warning beside it.

Rules for changing any of this

- A change to a sanitization path ships with a test that fails without it. Include the encoded and interleaved variants, not just the literal one.
- Escape trusted internal constants too, not only user text. A font stack or class name interpolated raw into a quoted attribute closes the attribute at its first quote and silently drops everything after it. "This value is ours" is not a reason to skip escaping.
- Verify a fix across all six compilers. A hole patched in the React renderer while html still emits the raw bytes is not patched.
- Never widen an allowlist to make a test pass. If a legitimate input is being rejected, narrow the rule at its cause.
