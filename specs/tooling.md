# Tooling

Build, quality gates, measurement, release, and generator scripts. Wave contents of verify, the pre-commit contract, and the harness commands are in AGENTS.md ("Git and process", "Repository configuration"); benchmark method is in standards/performance.md; the security gate's threat model is in standards/security.md. This spec holds the mechanisms behind them.

## Build

Purpose: emit one minified ESM and CJS bundle per package entry, with dev-only code removed and declarations present.

- `lib/bunup.config.ts` `defineConfig` list: every entry (`index`, `react`, `html`, `markdown`, `native`, `solid`, `vue`) is its own `Bun.build`, so a utils export one compiler imports never survives into another (for example `HTML_TO_JSX_MAP` into markdown). The `entities` config builds `entities.generated.ts` and `entities.browser.ts` separately so the package exports `browser` condition can swap them.
- `common.clean: false`: the configs run concurrently and share `outDir`, so bunup's default clean would race; the `build` script in lib/package.json removes `dist` before bunup runs.
- `manglePropsPlugin` rewrites each built chunk with esbuild: every property whose name starts with `_` is mangled, except `RESERVED_PROPS`.
- `RESERVED_PROPS`: `_store`, `_owner`, `_debugStack`, `_debugTask` (React reads them by literal name in dev and RSC builds and warns when they are missing) and `__html` (the `dangerouslySetInnerHTML` payload key).
- Biome may insert `import process from 'node:process'`, which makes `process` a local binding that `define` cannot replace. After minify the check reads `X.env.NODE_ENV!=="production"` (ESM) or `X.default.env.NODE_ENV!=="production"` (CJS), so `manglePropsPlugin` rewrites those predicates to constants before `minifySyntax`, dropping dev warning branches and their strings. The lookbehind `(?<![.\w$])` keeps `import.meta.env` from matching.

When a build finishes, it fails:

- `verifyReservedPropsPlugin`: `react.js` or `react.cjs` lacks a reserved React field
- `verifyDtsPlugin`: an entry point has no `.d.ts` or `.d.cts` beside it
- `verifyNoJsxAttrLeakPlugin`: `markdown.js` or `markdown.cjs` contains `allowTransparency`, the marker of `HTML_TO_JSX_MAP`
- `scripts/verify-declarations.ts` (run by the root `build` script): a `types` path in lib/package.json `exports` or top-level `types` is missing on disk

## Entry points and packaging

- `lib/src/index.tsx` imports the React compiler and re-exports it through local bindings (`var Markdown = _Markdown`) rather than `export { x } from './react.tsx'`: a re-export from a peer entry makes Bun's bundler emit dangling symbol references. Its default export and React exports are deprecated in favor of `markdown-to-jsx/react`.
- `lib/src/index.cjs.tsx` (deprecated) attaches `compiler`, `Markdown`, `RuleType`, and `parser` to the default export so `require('markdown-to-jsx')` keeps working.
- `lib/src/entities.browser.ts` (`decodeEntity`) decodes by setting a `textarea`'s `innerHTML` and reading `.value`, since the browser already holds the full entity table. It returns undefined outside a DOM and for an unknown name. The `./entities` export's `browser` condition selects it.

## verify

Purpose: one quality gate shared by local runs, CI, and the pre-commit hook (`scripts/verify`).

- Wave 0 (Biome) is the only job that writes to the tree; later waves read only.
- The Biome audit compares `git diff HEAD` after Biome against a snapshot taken before it (`pre_biome_diff`), so a local run with unrelated edits in flight reports only what Biome rewrote. Under `CI` a rewrite fails; locally it prints and continues.
- `now_ms` uses python3, since macOS `date` has no `%N`.
- The test job runs `bun test --coverage` under a 10 s CPU-time ceiling (`ulimit -S -t 10`, a soft limit only, since Linux sends SIGKILL rather than SIGXCPU when the hard limit equals it) into a file, then `scripts/check-coverage.ts` reads that file. A CPU ceiling catches an infinite loop at any machine load, where a wall-clock timeout also fires when the machine is merely busy; Bun's per-test timeout catches an async hang, which burns no CPU. Exit 152 (SIGXCPU) is reported as the ceiling.
- `typecheck:harness` runs in wave 3 because browser and native resolve `markdown-to-jsx/*` through package exports into lib/dist.

## pre-commit hook

Purpose: verify exactly the content being committed (`.githooks/pre-commit`).

When the hook runs, it:

- was installed from another checkout (an absolute `core.hooksPath` makes git run one checkout's hook for every worktree): `exec`s the committing worktree's own hook, so each worktree checks its files with its own verify
- finds no unstaged tracked edits and no untracked non-ignored files: runs `bun run verify` in place with `CI=1`
- finds anything else: checks the staged tree out into a temporary detached worktree, installs with `bun install --frozen-lockfile`, verifies there, and removes it

- The tree hash comes from `git write-tree` before `GIT_INDEX_FILE` is unset, because `git commit -a` and `git commit <paths>` point it at a temporary index that defines the commit's content.
- `git read-tree -u --reset` leaves the snapshot's index equal to the staged tree, so `git diff HEAD` there shows exactly the staged changes (the Biome audit relies on this).
- `cleanup` returns to the starting directory first (git cannot run from a directory about to be deleted), then `git worktree prune` also removes the snapshot of an earlier run killed before its cleanup.

## Gates

When a gate runs, it fails:

- `scripts/check-coverage.ts`: the `All files` row of `bun test --coverage` output reports function or line coverage under `FLOOR`; it reads a file argument, or stdin for `-` or no argument
- `scripts/redos-smoke.ts`: an adversarial case spends more process CPU time than `BUDGET_MS`, or than its own `budgetMs` (the `gfm-spec` case)
- `scripts/html-fuzz.ts`: see "Security fuzz" below
- `scripts/emit-selfcheck.ts`: the react (`renderToStaticMarkup`), html, or markdown output of a corpus in `CORPORA` (README, markdown-spec, stress fixture, gfm-spec) differs from `lib/src/.emit-golden.json`; `--save` rewrites the golden as two-space JSON with a trailing newline, and dev and production must match the same golden
- `scripts/hermetic-dist.ts`: a lib/dist `.js` or `.cjs` line (comment lines skipped) holds a network API needle (`fetch(`, `XMLHttpRequest`, `new WebSocket`, and the rest of its list), mirroring the source scan in lib/src/utils.spec.ts, or imports a `ForbiddenModules` entry (`node:process`, `process`): browser bundlers resolve `node:process` to `{}`, and the local binding defeats the `NODE_ENV` define, so the runtime crashes on `{}.env.NODE_ENV`
- `scripts/prod-strip-check.ts`: production dist keeps a dev sanitizer warning string, a live `console.warn(` or `console.error(`, or a `.env.NODE_ENV` (a failed define, usually from a local `process` binding)
- `scripts/llms-snippets.ts`: an executable fence of lib/llms.txt fails under `bun -e` from lib/; fences that reference undefined locals (`SKIP_IF`) and fences importing the native, solid, or vue entries are skipped

## Security fuzz

Purpose: a differential fuzz that reads every output the way a browser and downstream renderers do (`scripts/html-fuzz.ts`). What it fails on and allows: standards/security.md, "Rules for changing any of this".

- Run: `bun scripts/html-fuzz.ts [--count N] [--seed N] [--max-failures N]` (defaults in `readFlag` calls). The same seed and count build the same documents, so a failure is a reproducible bug, never a flake. Each failure prints shrunk to its smallest fragment list.
- parse5 runs with `scriptingEnabled: true`, matching a live page where `<noscript>` is raw text. `renderDownstream` (marked) and `renderCommonMark` (micromark) both render the markdown output; unsafe in either is a finding.
- `console.error` and `console.warn` are silenced: purpose-built bad input warns by design.
- `FRAGMENTS` is grouped by the reading difference each group targets (openers a tokenizer stays inside, values holding the end of earlier markup, built-in tag names an override lookup can answer, framework-acted attribute names, destinations another renderer splits, BOM handling, PI and CDATA terminators, and the rest); a new hole class gets its own group.
- `URL_REMOVED_R` and `URL_LEADING_R` strip what a browser removes from a URL (tab, LF, CR anywhere; C0 controls and space at the start) before `DANGEROUS_SCHEME_R` tests it.
- `SPACE_CODES` is every ECMAScript whitespace character, which the markdown output's destination scanner treats as a separator; `ODD_SPACES` is the subset a tokenizer or renderer can read differently.
- `RENDERER_ONLY_PROPS` are props a framework acts on (`children`, `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `ref`). `READING_CHANGING_OVERRIDES` are renames that change how a renderer reads what follows the tag. `REGISTERED_TAG` and `REGISTERED_OVERRIDES` model a sink that registers `Foo`.
- `findInTree` is a pre-order walk (template contents included); the first finding on a node wins. `findPropDanger` reads React and Vue props on `props` and Solid props on `p`; `innerHTML` and `dangerouslySetInnerHTML` are read as markup.

When `dangerOf` judges an attribute whose value starts with `{`, the attribute is:

- on an element whose name matches, case-insensitively, a capitalized tag written in the source or the registered tag: exempt, except a handler, which only the registered tag keeps
- on a hyphenated or standard tag: judged like any other value
- unless the handler attribute is empty: no finding, since it holds no script

## Differential

Purpose: list the inputs on which two markdown renderers disagree, so a question about what the references do, or what an option or a commit changed, is answered by a run (`scripts/differential.ts`). A developer tool, outside verify.

- Run: `bun differential --a <renderer> --b <renderer> [--corpus spec|fuzz] [--count N] [--seed N] [--option <name>] [--limit N]`.
- A renderer is a base name with any number of `+<option>` suffixes (`ours+breaks`). `RENDERERS`: `ours` (this checkout), `ours@<rev>` (that commit, extracted by `extractLib`), `markdown-it`, `marked`, `micromark`. Each runs its GFM configuration: ours is `parser` with empty heading slugs, then `astToHTML`; markdown-it has `html` and `linkify`; marked keeps its defaults; micromark has `gfm` and `gfmHtml` and allows raw HTML and every protocol.
- `OPTIONS` maps an option name to the base renderers that take it under the same key (`breaks`: ours, markdown-it, marked); naming the option on any other renderer ends the run with an error. An `ours@<rev>` older than the option ignores it.
- Corpus `spec` is every example in lib/src/commonmark-spec.json, the GFM extension sections included; `fuzz` builds `--count` documents from `FUZZ_TOKENS` with `createRandom(--seed)` (scripts/random.ts), so a seed reproduces its documents. `--seed` is at most 2^32 - 1, the generator's state width.
- `normalize` makes the outputs comparable: it removes whitespace beside a block tag (`BLOCK_TAG_R`) and at either end, which no browser draws and which the html compiler omits (BACKLOG.md, "Known spec deviations"); then parse5 parses and reserializes it, so a serializer difference (`<br />` against `<br>`, attribute quoting, entity spelling) is no disagreement; then a code block's final newline goes (`CODE_FINAL_NEWLINE_R`), which ours omits on purpose (same backlog section). Whitespace between inline tags and inside text still counts, and `<pre>` is no block tag here, since whitespace inside it draws. The whitespace goes before parse5 parses, because parse5 reopens an unclosed inline element (`<a>`) around whitespace that follows its block.
- Every flag and renderer name is checked before either side loads, so a typo costs no extraction; a failure prints the problem and the usage and exits 2.
- A renderer that throws yields `threw: <message>` as its output, so the input is listed instead of ending the run. An `ours@<rev>` whose html.ts lacks `parser` or `astToHTML` ends the run with an error naming the rev. `console.warn` is silenced, since the library's dev warnings fire on purpose-built bad input.

When a run ends, it prints:

- without `--option`: the agree and differ counts, then the first `--limit` differing inputs with each renderer's raw output
- with `--option`: the differ counts without and with the option on both sides, then the first `--limit` inputs on which the two agree without it and disagree with it, raw outputs with it
- `--a ours --b ours+<option>` lists every input the option changes at one commit

## Scaling smoke

Purpose: fail any adversarial input shape whose work grows faster than near-linear (`scripts/scaling-smoke.ts`). redos-smoke asks whether one payload is fast at one size, which a quadratic passes whenever that size is cheap; scaling-smoke measures the growth exponent, so the shape of the work fails, not the chosen size.

Constants: `MAX_EXPONENT`, `TARGET_MS`, `MIN_JUDGE_MS`, `MIN_SMALL_MS`, `BASE`, `MAX_SIZE`, `RUNS`.

- `bun scripts/scaling-smoke.ts [shape...]` measures only the named shapes; an unknown name exits 2. Verify runs it with no arguments.

- Per shape: double the input from `BASE` until the faster of two timed runs (the parser, or the markdown compiler for a `compile` shape) takes `TARGET_MS` or the input reaches `MAX_SIZE`; that size is `large`. Time `large` and `large / 4` alternately, `RUNS` times each, keep each size's fastest run, and score log4 of the ratio. Each `large / 4` sample times four parses and takes a quarter of the total, so both sides allocate the same amount and pay a like share of garbage collection: a single small parse can finish between collections, where a large one cannot, and its fastest run then reads as super-linear growth in an input that allocates a node per unit.
- Every timing is process CPU time (`process.cpuUsage`), as in redos-smoke: wall-clock time also counts the wait for a core, which on an oversubscribed machine inflates a long run of `large` more often than a short run of `large / 4` and so reads as super-linear growth. Process CPU time includes the engine's JIT and GC helper threads, so a reading can exceed wall time.
- Growing to a fixed time, not a noise floor, makes a small-constant quadratic visible; alternating sizes spreads the remaining noise over both; the fastest run is kept because noise only adds time.
- Each size is parsed once untimed first, since the first parse of a new input pays to flatten the built string (and, at the first size, to compile the parser).
- `MAX_EXPONENT` sits well above linear (1.0) and well under quadratic (2.0). A shape's own `maxExponent` replaces it for that shape: the one-line nested list and quote shapes, whose work is quadratic in nesting depth and capped by `MAX_PARSE_DEPTH` (specs/parser.md, "Work budgets"), allow 2.4. `MIN_SMALL_MS` keeps a zero timer reading out of the ratio. `console.warn` is silenced, since bad input warns per URL and logging would be the cost measured.

When a shape is scored, it reports:

- still under `MIN_JUDGE_MS` at `MAX_SIZE`: SKIP, a pass, since a quadratic that small is negligible at every real document size
- at or under `MAX_EXPONENT`: OK
- over `MAX_EXPONENT`: a second reading with twice the budget and runs, then `OK*` when it passes and FAIL when it does not (a real quadratic reads near 2.0 both times; contention rarely repeats)

- `OVERRIDE_KEY_COUNT` approximates a large `overrides` map; `TAG_ID_WIDTH` pads every tag id to one width so a tag name never grows with n; `distinctTags` gives each unit its own tag name so no two openers share a closer.
- Each case names the scanner or screen it watches and, where one exists, its issue (`link-empty-dest-openers`: issue #874).

## Paired timing gate

Purpose: catch a speed regression against the merge base before a PR. Method, scoring, and verdicts: standards/performance.md, "Benchmark methodology" and "Paired gate against the merge base". Limits: `CORE_LIMIT_PCT`, `JSX_LIMIT_PCT`, `SPREAD_LIMIT_PCT`, `TINY_LIMIT_PCT`, `TINY_SPREAD_LIMIT_PCT`, `TINY_ROUNDS` in scripts/metrics-gate.ts.

- `TARGETS` (scripts/metrics-targets.ts) is the one list of measurable entry points read by metrics.ts, metrics-gate.ts, and profile.ts; `jsx: true` marks targets judged against `JSX_LIMIT_PCT`.
- `PAIRED_INPUTS` are read from this checkout whichever root imports them, so both implementations time the same bytes; metrics-gate.ts requires exactly one row per entry.
- `ORDERS` (`candidate-first`, `candidate-second`) fixes one import order per process.
- `quantile` (scripts/metrics-sample.ts) takes `sorted[floor(q * (n - 1))]`, with no interpolation.
- `loadCompiler` registers this checkout's react-native mock before loading the `react-native` target, so the harness imports the same components native.tsx does.
- Every runtime measures production builds, as an app ships them: each child runs with `NODE_ENV=production` (`PRODUCTION_ENV`), and `BUNDLE_FLAGS` defines it in every bundle, so React's development build and the library's dev warnings stay out of the figures.
- With no runtime flag, each target runs under Bun on the TypeScript source. `--node` and `--chrome` replace Bun with the runtimes they name (`BUNDLED_RUNTIMES`; both flags run both). They stay opt-in: Node's run-to-run spread on the reference machine leaves most of its rows NOISY under the shared spread limits, and Chrome must be installed.
- `--node` runs a bundle per side, since Node's type stripping rejects a const enum; `bundleTargets` builds both sides with the same `bun build --target=node` into a temporary directory, and `metrics.ts --bundled` loads `bundlePath`. `SKIPPED_TARGETS` lists `react-native` for Node and Chrome, since its mock imports `bun:test`.
- `--chrome` runs headless Google Chrome (`channel: 'chrome'`, through `playwright-core`). `bundleTargets` builds both sides with `bun build --target=browser --minify`, and scripts/metrics-chrome.ts takes metrics.ts's arguments and runs the same sampling in a fresh browser per call, killed once its row prints, since a graceful close of headless Chrome takes seconds. The page is served from `localhost` with cross-origin isolation headers, since Chrome otherwise coarsens `performance.now()` to 100 µs, and the run throws when `crossOriginIsolated` is false or `gc` is missing.
- Each measurement runs as an awaited child process (`runMetrics`), so a SIGINT or SIGTERM ends the gate between children instead of after the whole run; the exit listener kills the running child, and every temporary directory is removed on exit as on a normal finish. A failure names the script that ran.
- scripts/metrics-sample.ts holds the sampling every runtime shares and imports nothing from Node, so the Chrome page loads it as a bundle. `PAIRED_WARMUP_ROUNDS` and `PAIRED_WARMUP_MS` are the two warmup floors; `PAIRED_SAMPLES` is even so every sample pair stays whole; `PAIRED_BLOCK_MS` and `TINY_BLOCK_MS` are the minimum timed block lengths the repeat count is calibrated to.
- `verdictOf` applies the verdict rules (standards/performance.md, "Paired gate against the merge base").
- `pairedRow` and `tinyCase` validate every value (`isRatio`: finite and positive), since `jsonLines` only types rows. `GateError` ends a run with a measurement the gate cannot score. `import.meta.main` guards the entry so scripts/metrics-gate.spec.ts can import the scoring functions.
- scripts/metrics-gate.spec.ts `BINARY_EXACT_LIMITS` uses powers of two so percent arithmetic is exact and a value on a limit is exactly on it; `eightSamplesAtQuartileRanks` places its values on ranks 1, 3, and 5, the lower quartile, median, and upper quartile of eight samples under `quantile`.
- scripts/checkout-ref.ts: `mergeBase` runs `git merge-base <ref> HEAD` and throws with a fetch hint for an unknown ref; `extractLib` extracts the ref's `lib/` into a temporary directory whose `lib/node_modules` links to this checkout's, removed by `cleanup` and on process exit. The SIGINT and SIGTERM handlers exit with 128 plus the signal number so the exit listeners still run. `extractLib` resolves the rev with `git rev-parse --verify --end-of-options` first and archives the resolved sha, so a rev that names no commit, or one shaped like an option, throws before `git archive` runs. Run directly (`bun scripts/checkout-ref.ts <rev>`), it extracts `<rev>`'s `lib/` the same way, keeps the directory, prints its path, and prints the command that removes it on stderr, so an older build imports by hand (`<path>/lib/src/html.ts`).

## Profiling

- `bun profile` (scripts/profile.ts) takes `--file <path>` (default lib/src/gfm-spec.md), `--target <name>` (default `parser`, resolved by `loadCompiler`), and `--streaming` (sets `optimizeForStreaming`). It runs `ITERATIONS` calls so the sampling profiler sees the hot paths, and mutes `console.log` so only `console.info` lines print.

## Bundle size

Purpose: report the bytes a consumer ships for each public entry (`bun run size`, scripts/bundle-size.ts).

- It bundles the built `lib/dist` (run `bun run build` first) from a temporary consumer folder whose `node_modules/markdown-to-jsx` links to lib, with esbuild minifying under `NODE_ENV=production` and every `peerDependenciesMeta` package external. The entries are the `exports` keys except `./entities`.
- Bundling from inside lib would resolve `markdown-to-jsx/entities` through lib's tsconfig path alias to the source table, so the consumer folder and `preserveSymlinks` are what let the `browser` export condition pick the DOM entity decoder.
- Each entry prints once per platform: `browser` (DOM entity decoder) and `node` (the generated entity table, as server, edge, and React Native builds get it), with minified, gzip level 9, and brotli bytes.

## Test support

- `lib/src/__mocks__/console-leak.ts` (bun preload): fails a test that leaks `console.warn` or `console.error`, except messages whose first argument equals an `ALLOWED_CONSOLE_PREFIXES` entry (intentional dev sanitizer and style-URL warnings). `drainConsoleLeaks` clears the buffer for tests that assert a warning. A test that spies on `console` replaces the wrapper; the `afterEach` hook calls `installLeakWrappers` again, which works because the preload installed first.
- `lib/src/__mocks__/react-native.ts` (bun preload): registers the `react-native` module with `mock.module`; `mockHostComponent` builds a `forwardRef` host that renders a plain string tag, so tests assert tag names while components keep react-native's shape.
- `lib/src/test-tree.ts`: `treeProps` walks a React, Solid, or Vue element tree (Vue slot content sits behind a `default` function; Solid props sit on `p`, React and Vue props on `props`; a Vue VNode keeps `children` beside its props). `storedAST` round-trips through JSON and drops every `_` field, so a compiler under test writes from public fields only. `escapeText` replaces `&` first so the entities written for `<` and `>` stay whole.
- `RuleTypeConst` (lib/src/types.ts): under `NODE_ENV === 'test'`, each value is replaced by its own key so failures print readable node types; production keeps the numeric values the type describes.

## Release attribution

Purpose: credit every commit behind a changeset (the rule for writing credits is in AGENTS.md, "Prose and communication").

- `scripts/changelog.cjs` is the changesets changelog generator, loaded with `require()` by @changesets/apply-release-plan, so it stays CommonJS; scripts/changelog.d.ts gives its importer real types. Unlike the stock generator, which cites one commit found with `--diff-filter=A`, it cites every add and modify, oldest first, and thanks their people.
- `ATTRIBUTION_LOG_ARGS` (`log --reverse --diff-filter=AM`) is shared with scripts/changeset-credits.ts so release notes and the credits report agree.
- `AGENT_EMAILS` and the `[bot]` name suffix in `isAgent` mark agents, which are never thanked automatically: credit the person the agent acted for, unless the agent originated the work. Matching uses the email alone because "Claude" is also a person's name.
- `FIELD`, `RECORD`, `TRAILER` are ASCII separator characters no git identity or subject holds.
- `attribution` reports `trustworthy: false` when any commit has no parent (a shallow clone's boundary commit reads as adding every file), and the generator then falls back; the release workflow checks out full history.
- `getReleaseLine` keeps the stock line shape and skips thanking a person already named in the summary. `getDependencyReleaseLine` is the stock one.

When `scripts/changeset-credits.ts` receives an argument, it reports:

- none: every pending changeset in name order, skipping `.changeset/README.md`
- a bare name, or a path with or without `.md`: that changeset
- a changeset with no commits reachable from HEAD: the authors found across every ref (`creditsFor` scope `all`: an unmerged branch, a squash-merge that renamed the file), marked as found outside HEAD
- a path with no history anywhere: no history, which usually means a mistyped name

Git authors and `Co-authored-by` trailers are both reported; agents are listed separately as not credited. `summaryOf` returns null for a file not in the tree, which covers both a released changeset and a typo, so the caller decides what to print.

## i18n validation

- `scripts/validate-i18n.ts` checks are listed in AGENTS.md ("Internationalization"). `githubSlug` keeps Unicode letters and numbers, drops punctuation, and turns whitespace into `-`; `decodeAnchor` percent-decodes TOC anchors before comparing; `extractHeadingTargets` collects ATX heading slugs plus HTML heading `id` attributes.

## Entity table generator

- `bun entities` (scripts/generate-entities.ts) regenerates lib/src/entities.generated.ts from the vendored lib/data/entities.json (WHATWG `entities.json`).

When `generateEntityConstants` stores an entity name, it:

- has case variants that all decode to the same characters: stores only the lowercase key
- has a lowercase key decoding differently from its exact-case form: stores both keys
- is lowercase with a "first two letters uppercase" variant (`AElig`) that decodes differently, and no "first letter uppercase" variant: maps the lowercase key to that variant's characters, so `&aelig;` keeps decoding to Æ

- The table ships as two packed strings that one loop unpacks into `NAMED_CODES_TO_UNICODE` at import, since a string of names compresses far better than an object literal. Groups are comma-separated, and a group's names are space-separated.
- `SINGLE` holds the single-code-point values sorted by code point: each group is the decimal gap from the previous group's code point (omitted when the gap is 1), then its names.
- `MULTI` holds each multi-code-point value, then its names.
- The generator throws when a multi-code-point value contains a space or a comma, since those are the separators.

## Stress fixture generator

- `bun scripts/generate-fixture.ts` (package script `fixture`, no arguments) writes lib/src/stress-test.generated.md: every supported syntax element at each size in `sizes` (`tiny`, `short`, `medium`, `long`, `veryLong`).
