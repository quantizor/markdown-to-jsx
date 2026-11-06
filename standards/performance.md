Performance standards

Depth behind the performance rules in AGENTS.md. Read before optimizing parser, compiler, or renderer code. Findings below were measured in this repository unless noted; re-measure before trusting any of them on a new runtime or engine version.

Bounded linear time, no backtracking

Every string operation must complete in bounded linear time. The shapes that break this rule:

- Nested quantifiers (`(\s*-+\s*)*`, `(a+)+`, `(\w+\s*)*`). Two quantifiers where one can match the other's input backtrack exponentially on a near-match that ultimately fails. This is the primary source of catastrophic backtracking.
- Adjacent capture groups over overlapping character classes (`(\w+)(\w+)`). When the separating delimiter is absent the engine tries every split point. Replace with a single charCode scan.
- `\s` where a newline is structurally invalid. `\s` matches `\n`, so a pattern meant to stay within one line wanders across line boundaries and backtracks. Restrict to `[ \t]`.
- A regex run against the whole document via `.match()` or `.test()`. A linear pattern pays repeatedly and a backtracking one detonates. Prefer one forward charCode walk.
- Unbounded `indexOf`, `lastIndexOf`, or `includes` inside a loop. Each call rescans from a fixed point, making the pair O(n*m). Clamp the search to the relevant range, typically the current line end.
- A memo keyed by a name the input chooses. Every new name misses it, so a run of `<x1> <x2> <x3>` pays a full search per name. Answer "does any closer of this name remain" from one table per string, and bound a search the table cannot answer, such as the bracket walk's read through tags, with a total per parse.

Emphasis parsing is the classic detonation site: `*`, `_`, and `~~` runs open and close in many combinations, and any matcher that tries every open/close pairing across N delimiters is super-linear in N. The linear form is the CommonMark delimiter stack. Push each delimiter run with its length and open/close potential, resolve in a single pass, mark consumed runs inactive.

Regex is not itself the problem. On large inputs (650K+ characters) the native engine is compiled to machine code, and one well-formed linear regex can beat a hand-written charCodeAt loop by about 2x. Use a linear regex for bulk scans and charCode walks for fine-grained structural decisions. Measure rather than assuming either.

Detect regressions with the 211KB GFM spec fixture plus adversarial inputs: thousands of `*`, deeply nested delimiters, delimiters that never close. A super-linear bug shows as wall-clock exploding with input size, or as an outright hang.

String handling in hot paths

- Track `segStart`/`segEnd` indices into the input and `slice()` once when the segment closes. Never accumulate with `out += s[i]`. `String.prototype.slice()` returns a view (pointer, offset, length) rather than a copy, so slicing stays cheap until the result is mutated or stored.
- Keep `.split()`, `.match()`, and `.slice()` out of tight loops. Each allocates. A charCode walk extracts the same result in one pass.
- In Bun/JSC, string `+=` beats array-push-then-`join('')` for small and medium segment counts, because JSC builds a rope (a tree of substring references) and defers the flatten until the string is consumed. A `charCodeAt` on the rope consumes it, so a check on output being assembled reads a smaller node instead. The usual "always build an array and join" advice is a V8 habit that does not hold here. Switch to join only when assembling a very large string from many pieces.
- `indexOf` for a single character is SIMD-backed. Prefer it to a manual charCodeAt loop when searching for one delimiter in a bounded range.
- For multi-condition classification (delimiter, whitespace, digit) a single charCodeAt walk against a 128-entry ASCII lookup table beats several regex passes.
- Do not call `.trim()`; it allocates. Track the trimmed `[start, end)` range and substring once at the emit point.
- Normalize at parse time rather than emit time when the normalization is deterministic, so emit stays a pure concatenation.
- A string the parser sliced and nothing has read yet is unresolved in JSC. The first `charCodeAt` (or index) on it pays to resolve it, about as much as a short regex test costs; a regex test reads it without resolving it, and does not make a later `charCodeAt` cheaper. On a per-node renderer path, decide with one regex test before reading characters.
- A whole-input scan on every parse (an `indexOf` for a rare character) is a measurable share of parsing a short input. Compute a per-document fact on first use, not up front.

Optimistic rewrite

For any function shaped "scan the input, conditionally fix it" (sanitizers, normalizers, escapers), do not allocate the output buffer until the first event that demands a rewrite. Clean input returns the original string and allocates nothing; dirty input backfills the prefix at the first edit and continues building. The anti-pattern is emitting into a result buffer on every boundary and then discarding it when the input turns out to be clean.

AST node representation

Measured across 27B, 80B, 600B, and mixed-nested scales:

- Numeric const enum tags plus plain object literals: wins or ties everywhere. This is what the parser uses.
- String tags (`kind: 'decl'`): within run-to-run variance.
- Class hierarchy plus `instanceof`: within variance.
- Segregated arrays per kind with typed-array order tracking: 20 to 40% slower everywhere. Rejected.
- Object pool with a wide uniform shape: slightly slower at non-trivial sizes. Rejected.

Const enums also give the smallest bundle (no `class` keyword, no inlined string literals) and clean narrowing.

Hidden-class stability is the rule that matters most: node shapes must be constant per type. `if (cond) node.extra = x; else node.other = y` produces two shapes and deoptimizes every consumer. Allocate all fields up front, even unused ones. Related: `new Array(n)` creates a holey array; use `[]`.

Factoring scan primitives

When five or more functions duplicate a "walk the string, track quote/paren/bracket nesting and escapes, stop on the first delimiter" state machine, factor it into one primitive taking the stop bytes as char-code parameters. Call sites stay monomorphic because the arguments are stable char codes, and the minifier collapses the duplicated loops into one body. Measured elsewhere at about 220 bytes gzip for one such factoring.

Do not factor AST node constructors this way. Diverse field shapes defeat sharing, and the helper costs more than the call sites save.

An inner scan loop must be `while (true)` with an explicit break, never `while (i < len)`. The loop condition is checked before the scan runs, so when a previous iteration lands `i` exactly at `len` the body never executes and the EOF branch inside it silently never fires. This shows up as an outer loop spinning forever on a state variable the inner loop was supposed to advance.

React dev-mode floor

Profiling a markdown-to-element compile shows 40 to 45% of wall time is React development-build overhead, not renderer work: `Object.freeze` on element and props (12 to 13%), `defineKeyPropWarningGetter` (5%), the `ReactElement` constructor (15 to 18% combined). This is a fixed floor while output must stay byte-identical, so compare renderer changes only against the same React build.

What is recoverable, all confirmed by paired A/B:

- Per-node closures allocated to serve an optional user render hook. Call render directly on the no-hook path and build the closure only when the hook exists.
- Per-node style-merge allocations. Precompute a per-compile cache, since every merge is a pure function of the resolved stylesheet, then swap the precomputed value into the props literal. Mutating a props literal before `createElement` is safe because React copies the config.
- A truthy-but-empty `overrides = {}` default forcing a lookup per node. Normalize empty overrides to `undefined` so the check short-circuits.
- Tag-to-component mapping per element. Replace with a Map memo keyed on the raw tag, size-capped against attacker-minted unique tags, falling back to recomputation when full.
- An inline host whose children are exactly one text node can pass the string straight to `createElement`. Gate this off when a user render hook exists, since that contract passes every node through the hook.
- Sharing a `createElement` config object across elements is byte-identical and safe, so one compile-wide literal can serve hundreds of bullets or dividers.

Benchmark methodology

`bun run metrics:paired` compares the working tree against its merge base with origin/main (method below). The `benchmarks/` workspace compares against other libraries. None of them is trustworthy without the following.

Position biases paired A/B runs. Two byte-identical copies of a module in one process time differently by position, not content: which was imported first, which runs first in each warmup round, and which is timed first within a sample. Five corrections, all required:

- Time each input in its own process. An input timed after others runs on code the engine specialized for them, and the implementation that tiers up first can stay on it for the rest of the process: the stress fixture timed after the two spec fixtures read 10 to 15% slower for whichever implementation led warmup, in both import orders.
- Tie the first warmup call to the import order and alternate the leader every round after it. Even in a fresh process the implementation that calls first tiers up first, a bias of a few percent that follows the leader; tied to the import order, the swap below cancels it.
- Warm up for a time floor, not only a round count. A fixed round count on a small input ends while the engine is still optimizing; the implementation that runs first in warmup then reads slower in both import orders, so swapping imports cannot cancel it.
- Score a pair of consecutive samples, one with each implementation timed first, as one ratio. The block timed second in a sample runs faster, so per-sample ratios are bimodal and their median jumps between the two clusters.
- Run each comparison twice with the import order swapped and score:

```
delta           = median over sample pairs of (candidate time / baseline time) - 1, positive when the candidate is slower
corrected delta = (delta with the candidate imported first + delta with the candidate imported second) / 2
position bias   = (delta with the candidate imported first - delta with the candidate imported second) / 2
```

Under the null the corrected delta lands within 3%, and a real effect keeps its sign in both orientations. Calibrate the inner repeat count so every timed block is at least 2.5ms regardless of input size.

Paired gate against the merge base

- Command: `bun run metrics:paired` (`scripts/metrics-gate.ts --against origin/main`, optionally `--target <name>` repeated and `--streaming`). Needs origin/main fetched. Without `--target` it measures every target plus the parser with `optimizeForStreaming`.
- Baseline: `git merge-base origin/main HEAD`, its `lib/` extracted to a temp dir that resolves dependencies through this checkout's `lib/node_modules`, removed afterward (`scripts/checkout-ref.ts`). Candidate: the working tree, uncommitted edits included, or a committed ref extracted the same way with `--candidate <ref>`. `--against HEAD --candidate HEAD` is a null run: the committed tree against itself, showing the noise floor on the current machine.
- Per target and input, `scripts/metrics.ts --against <dir> --order <order> --input <name>` runs once per import order, each in its own process. Each run imports both implementations, warms up for the round count and time floor above with the import-order-tied alternating leader, then takes 20 sample pairs, each sample one calibrated block per implementation with a GC before it, the pair timing each implementation first once. Inputs: the stress fixture, `markdown-spec.md` (27kB), and `gfm-spec.md` (211kB).
- Tiny case, per target: `scripts/metrics.ts --tiny --root <dir>` times an 18-byte input in a process that imports only that one implementation, reporting the median per-call time of calibrated blocks after a long warmup. The gate runs a fixed number of these processes per implementation, alternating which goes first, and scores the ratio of the two implementations' median per-call times. It runs cross-process because the import-position bias above grows as the workload shrinks and swamps a sub-microsecond delta; separate processes trade that bias for process-to-process spread, which the null run measures.
- Verdict: the corrected delta per target and input against the limits in `scripts/metrics-gate.ts`, one limit for the parser and string compilers, a looser one for the JSX renderers (framework element creation adds noise), and one for the tiny case, sized above the largest null-run tiny delta seen on a loaded machine. Prints every target and input with both orders' median and quartiles, and the tiny case with each implementation's median and quartiles; exits 1 when any delta is over its limit. A row whose quartiles span wider than its spread limit (in either import order, or either tiny implementation) reports NOISY instead of a verdict (also exit 1): a median that uncertain cannot resolve a delta the size of the limit, so rerun at low load. The exception is a row whose favorable bound already clears the limit (the lower quartile of the delta in both import orders; for the tiny case, the candidate's lower quartile against the baseline's upper): that regression holds whatever the spread, so it reports FAIL. A missing, duplicated, or non-finite measurement row exits 1 with the offending row rather than scoring it.
- Run it before opening a PR that touches `lib/src/`. It stays out of verify: a paired comparison cancels machine speed but not contention, and the pre-commit hook runs while sibling sessions load the same machine, which moves small workloads by more than the limit.

Sampling-profiler line attribution smears. `bun --cpu-prof` spreads self time onto lines adjacent to the real cost inside a function. Two false leads from one session: an `indexOf` on the line above a hot dispatch loop was credited 3 to 6% self time when its true cost was microseconds, and a bounded `indexOf` fast-reject two lines above a char walk was credited 6%. Function-level self time is trustworthy; line-level is not. Instrument call counts and scan distances with counters before optimizing a hot line.

Attribute a sub-microsecond cost by retired instructions, not wall time. On macOS `/usr/bin/time -l` prints instructions retired for a process; run the workload at two call counts and divide the difference by the difference in calls, so startup and compilation cancel. The count holds steady on a loaded machine where wall time does not. Revert one function at a time on a copy of the tree to attribute the cost, then confirm the result in wall time. JSC inlines a hot helper only under a bytecode-cost budget, and one added branch can push a per-node function past it, costing more than the branch itself: `BUN_JSC_reportCompileTimes=1` prints each optimized function's cost and `BUN_JSC_printEachDFGFTLInlineCall=1` each inlining decision. Keep a per-node common path small and move rare branches into a separate function.

Benchmark at multiple scales (about 30B, 80B, 600B, 2KB, 10KB, then the 211KB fixture). Speedups routinely collapse at large scales once GC pressure and string flattening dominate. Use a median across N measured runs after warmup, and `--expose-gc` with a collection between runs when measuring allocation-sensitive code.

Always include the incumbent in the benchmark from the first run. An ops/second figure means nothing without the thing it replaces measured beside it.

Engine caveat

Everything above is V8 and JSC. Hermes has different optimization tiers, string representation, and inline-cache behavior, and the rope-concat advantage in particular may not hold. Re-measure under Hermes before porting a tuned hot path into the React Native adapter.
