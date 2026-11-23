# Harnesses and workspaces

The unit-suite conformance corpora, the shared case corpus, and the unpublished workspaces that consume the built library: browser, native, benchmarks, and the site demo. Commands, ports, and the corpus contract are in AGENTS.md ("Repository configuration"); this spec holds the mechanisms behind them.

## Conformance and contract suites

Purpose: the unit-suite corpora that hold the library to a spec or a cross-compiler contract (lib/src, run by `bun test`).

- commonmark.spec.ts runs every CommonMark 0.31.2 example through `parser` then `astToHTML`. `disableAutoLink` is off only for the section "Autolinks (extension)" (bare URLs are a GFM extension; angle autolinks are core and always on), and `tagfilter` is on only for the section "tagfilter", since most examples expect it off.
- `normalizeHtml` (commonmark.spec.ts) removes line breaks with their following whitespace and whitespace between tags, forgiving the deviations listed in BACKLOG.md "Known spec deviations"; a content difference still fails.
- `SECURITY_DEVIATIONS` holds examples 156, 157, and 158, whose exact escaped output is asserted instead of the spec's: each is a tag still open at the end of its string, which a browser would read on into later markup (standards/security.md, "Threat model").
- security-parity.spec.ts asserts each danger case across every compiler. `DangerCase.absentFromMarkdown` lists only sinks the raw attribute screen clears for every output, since the markdown output applies no tagfilter.
- markdown.spec.ts `expectRoundTrip`: source and its parse, `astToMarkdown`, re-parse must render through `astToHTML` to equal HTML after the suite's own `normalizeHtml` (quote-aware, so a `>` inside an attribute value stays). A construct the round trip still corrupts stays out of the "HTML equivalence corpus" until fixed (BACKLOG.md, "astToMarkdown round-trip fidelity").
- fuzz.spec.ts bounds every case by `CI_TOLERANT_MAX_EXECUTION_TIME_MS`, generous for slow CI machines; random and adversarial inputs may throw, and only a hang or an exponential time fails.
- lib/src/__snapshots__/react.spec.tsx.snap holds the one external snapshot, owned by the test "handles a holistic example"; every other snapshot is inline.

## Shared case corpus

Purpose: one list of markdown features and issue regressions that every live harness asserts (`CASES` in fixtures/cases.ts).

- A case with `ref` traces to a GitHub issue. Every expectation was written against observed compiler output, so a red expectation is a parser or compiler bug until proven otherwise; never edit one to green without that investigation.
- `sel: ''` targets the case's output container (bare inline output). `HarnessCase.options` omitted means library defaults.
- `TRANSPARENT_PIXEL_PNG_DATA_URI` is the image every case uses: `data:image` is the only non-http scheme the sanitizer allows, React Native needs a loadable source to lay out, and a remote URL would make the harness fetch.

Case notes (by `id`):

- `blockquote-lazy`: DOM text joins the lines with `\n`; `toHaveText` collapses whitespace.
- `table-align`: alignment lands in inline styles, which the harness never asserts.
- `tagfilter-off-script-plain` (`skip: ['native']`): native has no script element; the browser asserts the live inert tag.
- `link-sanitize-entity-encoded`: the href is omitted as for a literal `javascript:` URL (standards/security.md, "URL sanitization").
- `hard-break-in-list-item` (#766), `escaped-ordered-list-marker`: trailing double spaces in `md` are the hard breaks under test.
- `triple-nested-divs` (#520): the bug emitted a stray `</div>` text sibling, so the case asserts the container holds no text.
- `html-block-emphasis-literal` (#860): rule in specs/parser.md, "HTML blocks".
- `setext-vs-list-streaming` (#827): rule in specs/parser.md, "Streaming edge".
- `literal-less-than-streaming`: streaming HTML deferral never truncates a prose comparison; single-line input renders inline in some compilers, so the case asserts the card root's text.
- `inline-html-edge-spaces` (#904): spaces just inside an inline tag stay, so words do not run together.

## Browser workspace

Purpose: mount every browser-eligible case through the shipped React, Solid, Vue, and Preact builds and assert the corpus contract in a real DOM.

- Two builds, four servers: React, Solid, and Vue share browser/vite.config.ts; Preact has browser/vite.preact.config.ts (own HTML entry `preact/index.html`, `outDir` `../dist-preact`) because a Vite alias is global to a build. It aliases `react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, and `react/jsx-dev-runtime` to preact/compat. Every server uses `strictPort`.
- Imports resolve through the package exports map into lib/, so the page tests the shipped artifacts and, through the `browser` condition, `entities.browser.ts`.
- The page has no JSX and no framework Vite plugin, so the harness carries no transform config. `mountReact` (browser/src/react-mount.ts) imports bare `react` and `react-dom/client`, so the build chooses the runtime; browser/preact/main.ts reuses it, which exercises the React compiler's delegation to the host `createElement`.
- `BROWSER_CASES` (browser/src/harness.ts) gives each case its own card and mount target, so a crashing case cannot take down its neighbors and a failure maps to a case id.
- browser/src/harness.ts sets `data-vite-mode` from `import.meta.env.DEV`, and the spec asserts it per project before any case: a console-error listener alone cannot prove the development project loaded a DEV build.
- Playwright starts all four servers through `webServer`; building is the caller's job. Each project pins `baseURL`, so a reused listener on another port cannot swap modes.
- The title `preact renders every case to contract` routes the Preact test (`grep` on the `preact-*` projects, `grepInvert` elsewhere). Renaming it breaks the routing.

When a renderers.spec.ts check fails, it means:

- in exactly one renderer: compiler drift
- in all four: a parser bug
- a short card count in production: the harness bundle predates the corpus; `bun test:browser` rebuilds it

- Error listeners attach before navigation, so a throw during module evaluation or any mount is reported.
- `isBenignReactCustomTagWarning` drops only React DEV warnings about the corpus's deliberate unknown custom tags ("incorrect casing", "unrecognized in this browser"); every other `console.error` and `pageerror` fails.
- `PREACT_CASES_WITH_CASE_PRESERVED_TAGS`: Preact creates unknown elements with their case kept (localName `MyComponent`), so lowercase type selectors cannot match; those cases are skipped for Preact only.
- `bodyHiddenFromToHaveText` (in `applyExpect`): Chromium hides `<script>` and `<style>` bodies from `toHaveText`, so text expectations on them read `textContent`.

## Native workspace

Purpose: render every native-eligible case in an Expo app from source, and smoke-test the built package under jest-expo.

- native/fixture.ts holds only native options (image layout) and the corpus filtered by `skip: ['native']`.
- native/App.tsx `CaseBoundary` wraps each case: a throw logs `CASE_THREW` to the Metro console and shows `THREW` on screen; the footer `END` confirms every case mounted.
- native/metro.config.js: `watchFolders` (lib/src, fixtures/) hot-reloads edits, which needs Watchman (AGENTS.md). `sourceEntries` maps `markdown-to-jsx/entities` and `markdown-to-jsx/native` to TypeScript source; every other library import is relative, so these two cover the tree. `isReactSingletonRequest` resolves `react`, `react/*`, `react-native`, and `react-native/*` from the harness node_modules, so one React and one React Native bundle.
- native/__tests__/markdown-test.tsx ("markdown-to-jsx/native built package") tests the built artifact through the exports map, never source, and runs under jest-expo only. React Native Testing Library's `render()` returns a Promise; tests await it and query the returned value, since the `screen` proxy is unreliable under bun's isolated install layout. Some cases (comments, stripped frontmatter) render a null tree; the contract is no throw. `prettierPath: null` leaves inline snapshots unindented (AGENTS.md).

## Benchmarks workspace

Purpose: compare markdown-to-jsx with other libraries and with its own baseline (benchmarks/index.ts; commands in AGENTS.md).

- The rehype processor chains remark-gfm, remark-directive (`[!NOTE]`-style directives, which may not match markdown-to-jsx exactly), remark-rehype with `allowDangerousHtml`, rehype-raw, and rehype-react, to match markdown-to-jsx's feature set. `remarkParseProcessor` is the parse-only chain.
- Only `markdown-to-jsx (next)` results are stored in `bench.baseline.json` and compared; the comparison is skipped when updating (`-u`).
- The diff colors a change only above `SIGNIFICANT_CHANGE_PERCENT`: green an improvement, red a regression.
- With `--expose-gc`, `global.gc()` runs between cycles so collection never lands inside a measured cycle.

## Site demo workspace

Purpose: the published demo page (site/), an editor and preview over a full-screen WebGPU lava lamp. Visual changes need consent (AGENTS.md, "Not applicable here").

- site/lava-lamp-shader.ts holds the WGSL apart from the React component, since the shader is what makes the scene expensive. `generateShaderCode` returns one module with entry points `simulate` (compute: particle physics), `vs_main`, and `fs_main` (fullscreen raymarch of the blended distance field). The WGSL string carries its own comments, which are string content.
- `generateParticleLoad` copies particles into a `var<private>` array once per pixel: the particle buffer is `read_write` (the compute stage writes it), and a writable storage buffer may alias, so the compiler cannot hoist loads out of `map()`.
- `generateMapFunction` unrolls the distance field over `numParticles`, so the loop bound is a compile-time constant.
- site/lava-lamp.tsx:
  - Every listener uses the `listeners` AbortController signal, so teardown is one `abort()`.
  - `saveIntervalMs`: particle state is saved for reloads only; a faster rate kept a GPU-to-CPU readback in flight and stalled the pipeline.
  - `renderScale` caps `devicePixelRatio` at 2; it is the only resolution concession.
  - `resizeCanvas` sizes from the canvas's own box (CSS svw/svh), never the visual viewport, which disagrees on iOS while the URL bar collapses. A `ResizeObserver` (`sizeObserver`) reports that box after layout and before paint, so the frame loop never reads layout; `startRect` sizes the first frame synchronously because the observer's first callback is a frame late. The frame reads `canvas.width` and `canvas.height` as the observer last set them.
  - `?fps` dynamically imports site/fps-meter.ts, so a normal visit loads none of it.
  - When a frame callback fires, it:
    - finds `document.visibilityState === 'hidden'`: requeues and skips GPU work, since some browsers throttle rather than stop `requestAnimationFrame`
    - arrives under `frameInterval * 0.9` since the last drawn frame: skips, capping at 60 fps while letting a callback a hair early on a 60 Hz display through
    - draws after a full interval (`fullIntervalElapsed`): carries the overshoot forward (`time - (elapsed % frameInterval)`), so cadence stays on a 60 fps grid
    - unless it was let through by the 0.9 slack: sets the marker to `time`, since the remainder there is the whole elapsed time and would let every later callback through
  - Encoders, passes, command buffers, and texture views hold no GPU memory, and the canvas texture belongs to the context, so nothing is destroyed per frame.
- site/fps-meter.ts: `sample(time, width, height, dpr)` shows the backing-store size and DPR beside the rate; the overlay is `aria-hidden`, since the text changes every `REPORT_INTERVAL_MS`; `destroy()` removes it.
- site/vite.config.ts excludes `react.tsx` modules (custom classic JSX) from the React plugin.
