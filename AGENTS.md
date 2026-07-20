You are maintaining markdown-to-jsx, a TypeScript toolchain containing a CommonMark+GFM markdown parser and six output compilers: react, native, solid, vue, html, markdown.

See README.md for the primary library documentation. This file is the map and the rules; it holds no feature specification.

Library priorities

Correctness, speed, then small output size, in that order. Pursue them in sequence: correct first, then fast, then small. Optimize code for minification and tree shaking, and prefer ES5 syntax so the engine takes its fastest path.

Method

- Think before you code. Most critical bugs come from misunderstanding the problem, not from typos. Build a mental model first; when a bug appears, reason about how the model is wrong rather than only where the symptom shows.
- Data first, code second. Choose the data structure before the algorithm; understand the shape, volume, and access pattern before designing around it.
- Before calling work done, argue the case that it is wrong: hunt the input that breaks it, the claim you cannot support, the requirement you skipped. Fix what that attack exposes.
- Fix at the cause. A change that stops a symptom without removing what produced it is a suppression, and they all read alike: a swallowed catch, a retry or sleep over a race, a raised timeout, a snapshot updated to green, a disabled lint rule, an `as any` over a type that will not check, a `|| ''` over an undefined. Where the cause is genuinely out of reach, say so plainly, name the suppression as a suppression, and log it to BACKLOG.md.
- Ground claims in fresh evidence. Re-read the file, re-run the command, re-render before reporting rather than trusting remembered state.
- Distinguish what was observed (file:line, command output, exact error string) from what was inferred.
- When two views of state disagree, verify the primitive (read the source, run the command by hand, check `--help`) before layering a workaround on top.
- Ask what an instrument returns when it fails and whether that is distinguishable from success. A grep whose pattern never matched and a profile attributing time to the wrong line both report confidently. Confirm any value you will act on with a second instrument whose failure mode differs.
- A source that describes or references a claim is not verification of it. Open the target before asserting what it says.
- Before deleting a function or option, state the behavior it produces today and confirm the named replacement covers that exact behavior, not an adjacently-named one.
- Before a batch operation across similar inputs (six compilers, four translated READMEs), validate a small sample covering every structurally distinct case and read the output content, not just exit codes or counts.
- Prefer an experiment to reasoning from what you already have. Ambiguity that feels like a judgment call is usually a measurable question nobody has measured yet.
- One fact, one home. Every fact lives in one place and everywhere else derives it or points at it. A value that can be derived is derived at the point of use.
- After changing a behavior, name, or value, grep the repo for every place that recorded the old one (docs, translated READMEs, tests, comments, CI, this file) and update them in the same change.
- Simplicity is not optional. Simple means not interleaved, not "easy to type." Every abstraction justifies itself with concrete reuse and a net reduction in complexity. Do not generalize before you need to; N is usually small, and fancy algorithms carry big constants and more bugs.
- Do not create a helper until the same pattern appears at least twice and the helper reduces total lines.
- Eliminate edge cases through better abstractions. Reformulate the problem so the special case disappears. When a bug recurs across many input combinations, find the structural rule that makes the whole class impossible rather than patching each permutation.
- Compose small, focused units. Design how modules communicate, not what they contain internally.
- Fail explicitly, recover independently. Do not hide errors behind silent fallbacks. Prefer corrective code over defensive code.
- Complete work end to end. A refactor includes removing the code it orphaned, as a separate step.
- Do not create summary documents or status files. Deliver summaries in conversation.

Correctness and types

- Types are law. Do not reach for `as any`, non-null `!`, `@ts-expect-error`, or `@ts-nocheck`; if a type will not check, restructure the code to express it properly. A `@ts-expect-error` asserting a negative-type behavior is a test and must be commented as such.
- Both tsconfigs run `strict`. `esModuleInterop` stays off deliberately: enabling it forces consuming libraries to enable it too.
- Backward compatibility is required only on the public API surface (exported functions, types, and options). Internal code is free to change, and internal complexity is an acceptable cost so long as observable behavior holds.
- Library code is self-contained at runtime: zero network dependencies, zero remote fetches. Nothing under `lib/src/` may fetch, request, or reference a remote URL at runtime, and the test suite asserts this. Dev-time scripts may fetch, but their output is committed and verified. Data dependencies are vendored and imported relatively.

Testing

- Tests ship with the feature, in the same change.
- Use red/green: confirm the test fails without the change before accepting that it passes with it.
- Every assertion has exactly one valid outcome and covers content and shape. No `toBeTruthy()` or `toBeDefined()`.
- Prefer inline snapshots (`toMatchInlineSnapshot()`) or full-output assertions over many small property checks.
- Normalize volatile non-contractual regions (generated ids, timings) to stable placeholders before asserting, and keep every contractual byte asserted, so a non-behavioral tweak never forces a test edit.
- Treat snapshot drift with suspicion. A changed snapshot is an unintended regression until proven otherwise.
- Add to existing test files rather than creating new ones. Renderer suites cover renderer behavior only; the parser suite covers parsing.
- Coverage floor is 80%. `bun test --coverage` prints the live function and line figures.
- `main` always passes 100%. A failure on a branch is that branch's fault, not the suite's.
- Run tests with a 5s timeout (`timeout 5 bun test`). The suite is far faster than that, so a timeout means an infinite loop or a runaway regression.
- When a compiler test fails, isolate it and check the parser output first to tell a parser bug from a compiler bug.
- There is no time limit on the work itself. Finish the task.

Inputs and error handling

- Every parsing and rendering path is an untrusted-input surface. The whole point of the library is rendering text somebody else wrote. Depth in standards/security.md.
- Sanitization is on by default and independent of any caller-supplied option, so a caller who reads no documentation still gets a safe result.
- Errors are well-typed, and a message names the active issue, where it occurs, and a concrete fix. Assume the reader knows nothing about the internals.
- Guard every dev warning and debug log behind `process.env.NODE_ENV !== 'production'` so production bundles drop both the message and the work that builds its arguments.

Security, depth in standards/security.md

- URL sanitization tests the raw input, then decodes once and re-tests a stripped copy. A literal-scheme check alone is bypassed by percent-encoding.
- Raw HTML attribute screening (`on*` handlers, `srcdoc`, dangerous-scheme URLs) runs independently of the caller's `sanitizer` option.
- `evalUnserializableExpressions` is opt-in, stays opt-in, and is never enabled as a side effect of another option.
- A change to a sanitization path ships with a test that fails without it, covering the encoded and interleaved variants rather than only the literal one.
- Escape trusted internal constants too. A value being ours is not a reason to skip escaping it.
- Verify a security fix across all six compilers. The string compilers are the more dangerous sink, not the less.
- Never widen an allowlist to make a test pass.

Performance, depth in standards/performance.md

- All string operations complete in bounded linear time with no backtracking. Prefer single-pass charCode scans over regex on hot paths.
- No nested quantifiers, no adjacent capture groups over overlapping character classes, no `\s` where a newline is structurally invalid, no regex over the whole document, no unbounded `indexOf`/`lastIndexOf`/`includes` inside a loop.
- Minimize allocations in hot paths: track `segStart`/`segEnd` indices and slice once rather than appending per character, and keep `.split()`, `.match()`, and `.slice()` out of tight loops.
- Keep AST node shapes constant per node type. A conditionally-assigned field creates a second hidden class and deoptimizes every consumer.
- Minimize intermediate representations. Every serialization boundary is wasted work; do maximum work per pass and keep one format through the pipeline.
- Measure, never guess. Profile before optimizing, and validate a hot-path approach with a microbenchmark rather than recall, since engine behavior changes between releases.
- Report benchmark spread alongside the median. A tight spread at a similar median is the better result for latency-sensitive work.
- Prefer `$.CHAR_*` constants from `lib/src/constants.ts` over raw char codes.

Prose and communication

- American English (color, recognize, center). Plain language over jargon; define a rare term on first use.
- No em-dashes. Use a colon, comma, period, or and/or/but.
- No attribution footers ("Generated with", "Co-authored-by", or similar) on commits, PRs, files, or any output.
- Conventional commit syntax on commits and PR titles. Do not use conventional-commit prefixes inside changeset bodies.
- Commit messages serve their audience: public-facing code describes user impact, internal code describes codebase impact. Both stay concise and speak in general terms.
- Changesets and PR descriptions are public-facing. Describe the change users perceive, in plain terms. No internal mechanics, file paths, flag names, or parser and AST terminology. Noteworthy changes and bugfixes get a changeset.
- Public-facing writing is first person from the maintainer and warm toward contributors. In issue and PR replies be warm, brief, and grounded: thank sincere reports, decline with a one-line reason and a workaround where one exists, and say you do not know rather than guess. Do not narrate internal triage or labeling.
- Outbound public writing carries only what the reader needs to act. Omit internal paths and unrelated context.

Comments and docs

- Block comments (`/** */`) on exported members, functions, types, and fields so they surface as hover documentation. Line comments are fine for notes inside a body.
- Comments disambiguate the CURRENT code. Never narrate an edit or describe how something used to work.
- Comment where a future committer could plausibly undo an intentional value, ordering, or branch without realizing why.
- A behavioral claim in a comment is an assertion to verify against the code, not narration. "Matches X", "allocates once", and "bounded at N" each name something greppable, and hedges like "in spirit" or "effectively" usually mark a divergence the author waved at rather than fixed.
- Record a durable gotcha at the site where the mistake happens, not only in a notes file nobody opens first.
- Documentation for a settled design lands before the implementation.
- Docs track current state, never completions, changelogs, or migration history. That belongs in git.
- Keep drift-prone measured numbers (test counts, timings, coverage percentages, bundle sizes) out of docs. State the budget or threshold and point at the command that prints the live figure. Version pins are load-bearing and stay.

Organization and naming

- Alphabetize fields in type and interface declarations and in object literals by default. Keep another order only when it is load-bearing, and say why in a comment. This applies to code you write and nearby code you edit, not to untouched files.
- Put renderer-agnostic AST logic in `lib/src/utils.ts` and call it from each compiler. Consolidate a duplicated utility rather than re-implementing it per renderer.
- A source file past roughly 1,000 lines is a prompt to ask whether it should split. The answer can be no: `lib/src/parse.ts` is one cohesive mechanism and stays whole. Generated files and data tables are exempt.
- Never include code that is not used.
- Build debugging and profiling helpers as general tools driven by the library's own APIs, and extend the existing harness rather than leaving a litter of one-off scripts.
- Keep scratch files and experiment scripts outside the repository tree.

Git and process

- Ask before pushing, every time. Approval for one push does not carry to the next.
- Never use `git stash`. Use a temporary commit instead.
- Never gate a shell `&&` chain on `grep -c` (a zero count exits 1) or on a piped command's exit status (a pipe reports only the last command's). Verify the intended step's own effect instead.
- Amend formatter output into the commit that produced it rather than making a style-only commit, as long as that commit is unpushed.
- Exclude the lockfile and generated site assets when capturing a diff for review, so the reviewable code is not buried.
- Reply to a code-review tool's inline comments inline and threaded to that specific comment, one reply each.
- Quality gates pass before any commit or push: `bun test` green, `bun run typecheck` clean, `bun run build` succeeding. CI runs exactly these.
- Rebuild the site (`bun build-site`) before committing when README.md, `lib/llms.txt`, or library code changed. Test-only changes are exempt.
- Run `bun run validate-i18n` before committing any i18n or documentation change.
- A dependency version change updates the lockfile in the same commit and is verified working.
- Versions are bumped and published by the release workflow from accumulated changesets. Never edit a version field or publish by hand.
- Package lifecycle and postinstall scripts stay off by default. `bunfig.toml` also sets a three-day `minimumReleaseAge` floor on installs as a supply-chain guard; do not lower it to unblock a dependency.

Wayfinding and backlog

- BACKLOG.md is the only backlog: open work, known issues, and deferred decisions. Removing an entry is the final step of the change that resolves it, and an entry that is only partly resolved is trimmed to its open remainder. Never mark an entry DONE in place; the completed record lives in git.
- This file and the standards/ docs are read by machines only. Terse plain text: dashes for lists, no headers, no bold, no tables, no horizontal rules, no markdown link syntax where a bare path says the same thing. No decoration, no meta-commentary, no examples unless the rule is meaningless without one.
- Keep this file free of detail trivially found by reading the source. The map below is wayfinding and stays; helper names, signatures, and constant values do not.
- When editing this file, touch only the lines your change requires. Do not rewrite an unrelated note as a side effect.
- This file carries rules, the codebase map, and pointers. A feature's mechanism, data shapes, and wiring live with that feature, not here.

Not applicable here

- Aesthetics and UX: the library is headless. The `site/` workspace is a demo; changes there are judged by rendering and viewing them, never asserted in a unit test.
- Database migrations and data lifecycle: there is no database and nothing is persisted.
- Secrets handling: the library holds no credentials and reaches no network.

Repository configuration

- Use `bun`, not `npm`. Use `bunx`, not `npx`. The repo uses the bun package manager and the bun test runner.
- `bun metrics --target <name>` (`scripts/metrics.ts`) measures one entry point against its stored baseline: `parser`, `react`, `react-native`, `html`, `solid`, `vue`, or `markdown` (defaults to `parser`). Run it three times when checking a library change. Re-baseline with `-u` in the release flow so the stored baseline does not go stale and misreport unrelated movement as a regression.
- `bun profile` produces a CPU profile; `--cpu-prof-md` writes it as markdown (`CPU.*.md`).
- The `benchmarks/` workspace is the single cross-library benchmark surface. `bun bench` compares the working copy against the published version; `bun bench:jsx`, `bun bench:html`, and `bun bench:all` add `Bun.markdown`, marked, markdown-it, react-markdown, and remark across 1kB/27kB/211kB inputs with a baseline diff. Extend this workspace rather than adding standalone benchmark scripts.
- The largest fixture (`gfm-spec.md`, 211KB) is what surfaces O(n*m) issues. Use it plus adversarial inputs (thousands of `*`, unclosed delimiters) when touching parser hot paths.
- `bun scripts/emit-selfcheck.ts [--save]` checks renderToStaticMarkup byte-equality against a golden file. Run it in both dev and `NODE_ENV=production` when touching the React emit path.
- `lib/llms.txt` is a hand-maintained machine-oriented cheatsheet (llmstxt.org), not a copy of the README: entry-point table, options table, condensed recipes, AST node shapes, do/don't, version notes. It ships in the npm package and `bun build-site` copies it to `docs/llms.txt`. Update it whenever an entry point, option, exported name, or AST node shape changes, and verify every snippet by running it. What earns a section is issue-tracker demand, not README structure: mine the tracker, where closed "how do I" issues are the best signal. It is human-adjacent and keeps its markdown formatting.
- `docs/` is the published website (GitHub Pages, built by `site/`), not a documentation folder. Agent-facing depth docs live in `standards/`.

Compiler parity

Six output compilers: react, native, solid, vue, html, markdown. Any change to rendering behavior, especially HTML block handling, must be verified across all six rather than the one in front of you. They drift: the JSX renderers share AST logic through `utils.ts` but assemble elements with their own primitives, while html and markdown emit strings.

- Put renderer-agnostic AST logic in `utils.ts`; keep only element assembly per renderer.
- Add a regression test to every affected compiler suite when fixing a rendering bug. Output shape differs per renderer, so assert each one's actual structure: serialize the JSX renderers to a string and snapshot, and snapshot the returned string for html and markdown.
- react-native cannot be imported directly in `bun -e`; preload the mock (`bun --preload ./lib/src/__mocks__/react-native.ts`), then walk React elements via `.type` and `.props.children`.
- `react-dom/server` resolves only from `lib/`, so run one-off React render checks as `cd lib && bun -e "…"` with paths relative to `lib/src`. From the repo root the import fails outright.

Key library files

- `lib/src/parse.ts` - the parser and AST generation
- `lib/src/types.ts` - AST node, option, and state types
- `lib/src/utils.ts` - entity decoding, sanitization, slugification, character classification
- `lib/src/constants.ts` - character code constants
- `lib/src/entities.generated.ts` - generated HTML entity mappings, regenerate with `bun entities`
- output adapters: `react.tsx`, `native.tsx`, `solid.tsx`, `vue.tsx`, `html.ts`, `markdown.ts`
- entry points: `lib/src/index.tsx` (main, re-exports parser/types/utilities) and `lib/src/index.cjs.tsx` (CommonJS, with deprecated exports)

Internationalization

- Localized content lives in `lib/src/i18n/`. Each language needs `README.md`, `default-template.md`, `gfm-spec.md`, and `markdown-spec.md`. UI strings are in `ui-strings.ts`; supported languages in `languages.ts`.
- `lib/README.md` is the single source for library docs. Any edit propagates in the same change to every `lib/src/i18n/{lang}/README.md`: copy it verbatim into `en/README.md` as an exact mirror, and translate the changed sections into `hi` and `zh` per their `.cursor/rules/i18n-{lang}.mdc`. `validate-i18n` checks file and UI-string completeness only, not README content, so verify parity by hand: equal fenced-code-block counts across all four files (`grep -c '^\`\`\`'`), every translated table-of-contents anchor resolving to a heading in its own file, and every `lib/README.md` section present in each translation. Keep code identifiers, API names, and anchors as each file already does.
- Order new languages by global speakers (Ethnologue 2025, https://www.ethnologue.com/insights/most-spoken-language/): English, Mandarin Chinese, Hindi, Spanish, Arabic. A new language gets a PATCH changeset and its own `.cursor/rules/i18n-{lang}.mdc` covering term translations, style, technical-term handling, and format conventions, written for machine interpretation.
- Documentation standards: Simplified Chinese (普通话), Modern Standard Hindi (मानक हिन्दी, formal आप).
- In code examples keep API names, package names, and technical constants in English; translate string literals, user-facing text, natural-language comments, and example markdown while preserving syntax.
- Keep JSDoc English-only. Do not add `@lang` tags or inline translations to source.
- Changesets are English-only.
- Prefer native or idiomatic words over transliterations for user-facing text. For technical terms give the native word first and the transliteration second (Hindi: सुझाव/टिप for "tip"). Transliteration is acceptable where no native equivalent exists (कंपोनेंट for "component"). Verify against actual usage in the target language's technical community (React docs, MDN, official framework translations).

Reference documents

- standards/performance.md - hot-path string handling, ReDoS shapes, AST representation findings, React dev-mode floor, benchmark methodology
- standards/security.md - threat model, URL sanitization algorithm, raw HTML attribute screening
- compiler-wisdom.md - production compiler technique: AST design, scanner optimization, string handling, parallelism
- BACKLOG.md - open work and known issues
