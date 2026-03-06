# Compiler Wisdom

Distilled principles from production compilers, expert practitioners, and the greatest software engineers. Read this before designing or optimizing parser/compiler code.

## Table of Contents

- [Part 1: Compiler & Parser Techniques](#part-1-compiler--parser-techniques)
- [Part 2: Wisdom from the Greats](#part-2-wisdom-from-the-greats)
---

## Part 1: Compiler & Parser Techniques

### 1. Minimize AST Passes

Merge lexing, parsing, and transformation into as few passes as possible. Each pass is a full traversal; fewer passes keep data cache-hot.

- esbuild uses only 3 full AST passes: (1) lex + parse + scope setup + symbol declaration, (2) bind + constant fold + syntax lower + mangle, (3) print + source maps. [[esbuild architecture]](https://github.com/evanw/esbuild/blob/main/docs/architecture.md)
- OXC combines multiple optimizations into single passes with early termination. [[OXC performance]](https://oxc.rs/docs/learn/performance)
- Biome parses once and reuses the tree for formatting, linting, and analysis. [[Biome announcement]](https://biomejs.dev/blog/announcing-biome/)
- Lua emits VM instructions during parsing with no AST construction at all. [[Implementation of Lua 5.0 (PDF)]](https://www.lua.org/doc/jucs05.pdf)

> "The fewer passes you have to make over your data (and also the fewer different representations you need to transform your data into), the faster your compiler will go." -- Evan Wallace [[esbuild FAQ]](https://esbuild.github.io/faq/)

### 2. Scanner & Lexer Optimization

- **ASCII lookup tables**: V8 uses a 128-entry table with classification flags (ID_Start, ID_Continue, keyword start). Single table lookup + branch replaces multiple comparisons. Gains: 1.2-2.1x across token types. [[V8 scanner blog]](https://v8.dev/blog/scanner)
- **String views over copies**: Point into the original input rather than allocating new strings for token text. [[xnacly fast lexer strategies]](https://xnacly.me/posts/2025/fast-lexer-strategies/)
- **Hash-while-scanning identifiers**: Compute the hash value simultaneously with parsing the identifier. Avoids a separate hashing pass. [[Sean Barrett lexing strategies]](https://nothings.org/computer/lexing.html)
- **Split hot loops by radix**: V8 uses three specialized number-scanning loops (decimal, hex, octal) instead of checking radix every iteration. Fewer branches in hot loops = faster scanning. [[V8 scanner blog]](https://v8.dev/blog/scanner)
- **Keyword detection via word-sized comparisons**: If all keywords fit in 8 bytes, pack them into a 64-bit register for comparison instead of string comparison. Beat the `logos` lexer generator by 30%. [[alic.dev fast lexing]](https://alic.dev/blog/fast-lexing)
- **Direct-coded vs table-driven lexers**: re2c-style directly-coded engines (using goto) are 2-3x faster than flex-style table-driven engines. [[alic.dev fast lexing]](https://alic.dev/blog/fast-lexing)

### 3. Parser Architecture

**Handwritten recursive descent dominates**: 8 of the top 10 Redmonk languages use handwritten parsers. Go saw an 18% parsing speedup switching to handwritten in Go 1.6. [[Phil Eaton survey]](https://notes.eatonphil.com/parser-generators-vs-handwritten-parsers-survey-2021.html)

**Pratt parsing for expressions**: Handles all precedence levels in a single loop controlled by binding power values, eliminating one function call per precedence level that traditional recursive descent requires. Used in JSLint, rust-analyzer, and many production parsers. [[matklad Pratt parsing]](https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html) [[Bob Nystrom Pratt parsers]](https://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/) [[Crockford TDOP]](https://www.crockford.com/javascript/tdop/tdop.html)

**Lazy parsing (pre-parsing)**: V8's preparser syntax-checks functions without building a full AST. The preparser is ~2x faster than the full parser. Full parsing happens on-demand when functions are actually called. [[V8 lazy parsing blog]](https://v8.dev/blog/preparser)

**Error-tolerant (resilient) parsing**: LL parsers naturally handle well-formed prefixes of incomplete constructs. Lossless syntax trees store all whitespace and trivia, enabling perfect source reconstruction. [[matklad resilient LL parsing]](https://matklad.github.io/2023/05/21/resilient-ll-parsing-tutorial.html)

**Parser combinator overhead**: 5-10x performance overhead vs hand-rolled recursive descent. Monadic combinators resist optimization because predicates are undecidable. Use for prototypes; replace if measurement shows problems. [[HN discussion]](https://news.ycombinator.com/item?id=18838767)

### 4. Memory-Efficient AST Representations

**Flat arrays with indices**: Replace pointer-based tree nodes with indices into flat arrays. 32-bit indices halve reference sizes vs 64-bit pointers. Measured 1.5-2.4x speedup from flattening alone. [[Adrian Sampson flattening ASTs]](https://www.cs.cornell.edu/~asampson/blog/flattening.html) [[Super-flat ASTs]](https://jhwlr.io/super-flat-ast/)

**Struct-of-Arrays (SoA)**: Store each field in its own array instead of an array of structs. Zig reduced tokens from 64 bytes to 5 bytes. Results: 20% wall-clock reduction in tokenizer/AST creation, 40% in IR generation. [[Zig AST rework PR]](https://github.com/ziglang/zig/pull/7920) [[Andrew Kelley DoD talk (HN)]](https://news.ycombinator.com/item?id=40980911)

**Arena/bump allocation**: O(1) allocation (increment pointer), O(1) deallocation (free the entire arena). OXC's arena allocation yielded ~20% speedup. Arena-allocated nodes are contiguous in memory, improving cache line utilization. [[OXC performance]](https://oxc.rs/docs/learn/performance) [[Ryan Fleury arena allocators]](https://www.rfleury.com/p/untangling-lifetimes-the-arena-allocator) [[Chris Wellons arena tips]](https://nullprogram.com/blog/2023/09/27/)

**Stop storing derivable data**: Zig removed line/column info from tokens because it can be lazily computed from byte offset. Every byte saved on the most-frequent struct is multiplied by millions of instances. [[Zig DoD issue]](https://github.com/ziglang/zig/issues/2078)

**u32 spans**: OXC changed usize to u32 for span offsets (files > 4GB are pathological). Up to 5% improvement on large files. [[OXC AST design]](https://oxc.rs/docs/contribute/parser/ast)

### 5. String Handling

**Zero-copy parsing**: Store `(start, end)` index pairs into the original source string. Slice only at output time. Eliminates all intermediate string allocations during parsing. In V8/JSC, `String.prototype.slice()` returns a view (pointer + offset + length). [[Zero-copy techniques (Go)]](https://goperf.dev/01-common-patterns/zero-copy/) [[Manish Goregaokar zero-copy]](https://manishearth.github.io/blog/2022/08/03/zero-copy-2-zero-copy-all-the-things/)

**String interning**: Deduplicate strings to integer IDs. Comparison becomes O(1) integer equality. V8 deduplicates at the scanner boundary. rustc uses an interned `Symbol` type. A broken interning function in rustc caused 59% excess peak memory and page faults. [[matklad rust interner]](https://matklad.github.io/2020/03/22/fast-simple-rust-interner.html) [[Nethercote rustc 2019]](https://blog.mozilla.org/nnethercote/2019/07/17/how-to-speed-up-the-rust-compiler-in-2019/)

**Caveat -- interning vs parallelism**: OXC found that global mutex lock contention from string-cache was a bottleneck during parallel parsing. Removing it improved parallel parsing by ~30%. Interning helps single-threaded; hurts multi-threaded. [[OXC performance]](https://oxc.rs/docs/learn/performance)

**Small string optimization**: Strings <= 24 bytes stored inline without heap allocation. Covers the majority of identifiers. [[OXC AST design]](https://oxc.rs/docs/contribute/parser/ast)

**SIMD string scanning**: simdjson processes 32 bytes simultaneously, producing bitsets of structural character positions. 4x faster than RapidJSON. Native `indexOf` for single chars uses SIMD internally in V8/JSC -- prefer it over manual charCodeAt loops. [[simdjson]](https://github.com/simdjson/simdjson) [[StringZilla]](https://ashvardanian.com/posts/stringzilla/)

**Rope concat in JSC/Bun**: String `+=` is faster than array-push + join for small/medium segments because JSC uses rope concatenation internally. Only use array-join for very large strings with many pieces.

### 6. Avoiding Regex Pathologies

- **Thompson NFA guarantees linear time**: Tracks all states simultaneously. O(n * m) worst case where m is pattern size. No exponential blowup. Go's regexp uses this exclusively. [[Russ Cox regexp1]](https://swtch.com/~rsc/regexp/regexp1.html)
- **Nested quantifiers cause exponential backtracking**: Patterns like `(\s*-+\s*)*` are the primary danger. [[Snyk ReDoS]](https://snyk.io/blog/redos-and-catastrophic-backtracking/)
- **Restrict `\s` to `[ \t]`** when newlines are structurally invalid. `\s` includes `\n`, causing cross-line backtracking.
- **Adjacent capture groups with overlapping character classes**: Cause backtracking when the delimiter is absent. Replace with charCode scans.
- **Regex on unbounded input is inherently risky**: Prefer charCode scans that walk the string once in a single forward pass.
- **When regex wins**: On large inputs (650K+), V8/JSC's native regex engine (compiled to machine code) can be 2x faster than JS character loops. [[ratfactor benchmarks]](http://ratfactor.com/cards/js-string-parsing)

### 7. Incremental & Tree Architecture

**Red-Green trees (Roslyn)**: Two layered trees. The green tree is immutable, persistent, built bottom-up with no parent references. The red tree is computed on-demand. ~95% of keyword occurrences share the exact same green node object. O(log n) incremental re-parsing. [[Eric Lippert red-green trees]](https://ericlippert.com/2012/06/08/red-green-trees/)

**Tree-sitter incremental parsing**: Structural sharing between old and new trees. Only edited portions are re-parsed. Re-parsing after a small edit is sub-millisecond. [[Tree-sitter GitHub]](https://github.com/tree-sitter/tree-sitter)

**Query-based compilation (rustc)**: Instead of sequential stages, the compiler has memoized queries. On re-compilation, only queries whose inputs changed are re-executed. [[Rust incremental compilation]](https://blog.rust-lang.org/2016/09/08/incremental.html)

### 8. Parallelism

- esbuild: Parsing and codegen are embarrassingly parallel. Go's shared heap avoids JS's serialization overhead between worker threads. [[esbuild FAQ]](https://esbuild.github.io/faq/)
- SWC: Work-stealing parallelism via rayon. 20x faster than Babel single-threaded, 70x on 4 cores. [[SWC website]](https://swc.rs/)
- Mold linker: Links Chrome (2 GB) in ~2 seconds (~2x the time to `cp` the file). 5x faster than lld, 25x faster than GNU gold. Speculative preprocessing + aggressive multi-core parallelism. [[Mold slides]](https://easybuild.io/tech-talks/006_mold_slides.pdf)
- TypeScript Go port: Native compilation (3-4x) + parallel type checking (2-3x) = ~10x total. [[TypeScript native port blog]](https://devblogs.microsoft.com/typescript/typescript-native-port/)

### 9. Compiler Optimization Passes

- **Constant folding + propagation + DCE work iteratively**: Each creates opportunities for the others. [[Constant folding (Wikipedia)]](https://en.wikipedia.org/wiki/Constant_folding)
- **Phase ordering matters**: LLVM has 100+ passes. Mutually beneficial sub-sequences should be treated as units. [[Phase ordering (arxiv)]](https://arxiv.org/html/2410.03120v2)
- **SSA form**: Each value defined exactly once. Enables CSE, DCE, constant propagation, and register allocation. [[LLVM passes docs]](https://llvm.org/docs/Passes.html)
- **Modular pass architecture**: Each pass does one thing well. Analysis passes compute; transform passes mutate. [[AOSA Book: LLVM]](https://aosabook.org/en/v1/llvm.html)
- **Deferred error analysis**: Keep the hot parsing path free of complex error handling. Delegate to a separate semantic analyzer. (OXC: 3x faster than SWC, 5x faster than Biome.) [[Pursuit of Performance (Rust Magazine)]](https://rustmagazine.org/issue-3/javascript-compiler/)

### 10. Interpreter & VM Design

- **NaN boxing**: Pack all value types into 64 bits using IEEE 754 NaN payloads. Half memory vs tagged union. ~20% speedup in Lua. Used by LuaJIT, JavaScriptCore, SpiderMonkey. [[NaN boxing blog]](https://piotrduperas.com/posts/nan-boxing/) [[Crafting Interpreters optimization]](https://craftinginterpreters.com/optimization.html)
- **Register-based > stack-based bytecode**: Fewer instructions, avoids separate operand stack memory traffic. (Lua, LuaJIT 2.) [[Crafting Interpreters bytecode]](https://craftinginterpreters.com/chunks-of-bytecode.html)
- **Trace compilation**: Profile during execution, JIT-compile hot loops. Allocation sinking eliminates temporary objects that don't escape their trace. [[LuaJIT allocation sinking]](https://github.com/tarantool/tarantool/wiki/LuaJIT-Allocation-Sinking-Optimization)
- **Streaming/one-pass compilation**: V8's Liftoff compiler for WebAssembly iterates bytecode once, emitting machine code immediately. No IR, no optimization passes. [[V8 WASM pipeline]](https://v8.dev/docs/wasm-compilation-pipeline)

### 11. JavaScript Runtime Considerations

- **Hidden classes**: Initialize all object properties in the same order in constructors. Objects with identical structure share a hidden class, enabling inline caching.
- **Short-lived objects**: Objects that die before the next minor GC (scavenge) incur near-zero GC cost.
- **Monomorphic call sites**: Ensure functions are called with consistent argument shapes to enable JIT optimization.
- **Vec growth strategy matters**: rustc changed Vec growth from `0, 1, 2, 4, 8, 16` to `0, 4, 8, 16`, reducing total allocations by 10%+. Similar principles apply to JS array pre-sizing. [[Nethercote rustc optimizations]](https://nnethercote.github.io/2022/02/25/how-to-speed-up-the-rust-compiler-in-2022.html)
- **Babel's overhead**: `babel-traverse` is 8-16x slower than `babel-walk` because it doesn't cache visitor explosion. Each plugin adds another full AST traversal. [[babel-walk]](https://github.com/pugjs/babel-walk)

---

## Part 2: Wisdom from the Greats

### John Carmack

"Your head is a faulty interpreter." Minimize state mutation. Maximize code analyzability. Inlining large functions (even 2000 lines) makes execution order obvious and prevents unintended call sites. Static code analysis is the most important practice -- more valuable for the mindset change than the bugs caught.

> "The real enemy addressed by inlining is unexpected dependency and mutation of state, which functional programming solves more directly."

[[Carmack on Inlined Code]](https://cbarrete.com/carmack.html) [[Carmack on Static Analysis]](http://www.sevangelatos.com/john-carmack-on-static-code-analysis/)

### Mike Acton

**The Three Big Lies**: (1) Software is a platform -- the hardware is the platform. (2) Code should model the world -- real-world IS-A relationships don't map to data transformations. (3) Code is more important than data -- the transformation of data is the only purpose of any program.

> "If you don't understand the data, you don't understand the problem."

10x improvements come from data layout transformations, not algorithmic cleverness. Design for the "multiple" case -- there is never "one" of anything important.

[[CppCon 2014 talk]](https://isocpp.org/blog/2015/01/cppcon-2014-data-oriented-design-and-c-mike-acton) [[Data Oriented Programming]](https://dataorientedprogramming.wordpress.com/tag/mike-acton/)

### Casey Muratori

Polymorphism, virtual dispatch, and deep class hierarchies create indirection that defeats CPU branch prediction and cache locality. Organize code by what operations do, not by what types represent.

> "I've never seen a codebase written with 'clean code' principles in mind that is also maintainable and easy to develop on top of."

[[SE Radio 577]](https://se-radio.net/2023/08/se-radio-577-casey-muratori-on-clean-code-horrible-performance/)

### Rob Pike

**The 5 Rules**: (1) You can't tell where a program spends its time. (2) Measure before tuning. (3) Fancy algorithms are slow when n is small, and n is usually small. (4) Fancy algorithms have more bugs. (5) **Data dominates** -- if you've chosen the right data structures, the algorithms will be self-evident.

[[Pike's 5 Rules]](https://users.ece.utexas.edu/~adnan/pike.html) [[Notes on Programming in C]](http://doc.cat-v.org/bell_labs/pikestyle)

### Ken Thompson

"When in doubt, use brute force." Think about *how* a bug came to be -- build a mental model and find where the model is wrong. Small teams produce better abstractions because committee designs accumulate everyone's favorite feature.

[[Best advice from Ken Thompson (Pike)]](https://www.informit.com/articles/article.aspx?p=1941206)

### Linus Torvalds

Good taste means eliminating edge cases through better abstractions. The linked list `**p` example: use an indirect pointer to make the special case for deleting the first element disappear.

> "Bad programmers worry about the code. Good programmers worry about data structures and their relationships."

[[Torvalds good taste (GitHub)]](https://github.com/mkirchner/linked-list-good-taste) [[Torvalds on Wikiquote]](https://en.wikiquote.org/wiki/Linus_Torvalds)

### Rich Hickey

**Simple vs. Easy**: Simple means not interleaved (objective). Easy means familiar (subjective). Complecting (braiding together) is the root of complexity. State complects value and time. Inheritance complects types.

> "Most critical bugs come from misunderstanding the problem, not from implementation errors." (Hammock-driven development)

[[Simple Made Easy transcript]](https://github.com/matthiasn/talk-transcripts/blob/master/Hickey_Rich/SimpleMadeEasy.md) [[Hammock Driven Development]](https://github.com/matthiasn/talk-transcripts/blob/master/Hickey_Rich/HammockDrivenDev.md)

### Joe Armstrong

"You wanted a banana but what you got was a gorilla holding the banana and the entire jungle." Let things crash. Write corrective code, not defensive code. Keep state explicit and visible.

[[Why OO Sucks]](http://harmful.cat-v.org/software/OO_programming/why_oo_sucks) [[Joe Armstrong's legacy (The New Stack)]](https://thenewstack.io/why-erlang-joe-armstrongs-legacy-of-fault-tolerant-computing/)

### Donald Knuth

> "We should forget about small efficiencies, say about 97% of the time: premature optimization is the root of all evil. Yet we should not pass up our opportunities in that critical 3%."

Literate programming: writing in teaching mode to another human produces fewer mistakes and takes less time. Forces poorly thought-out designs to become obvious.

[[Literate Programming (PDF)]](https://www.cs.tufts.edu/~nr/cs257/archive/literate-programming/01-knuth-lp.pdf) [[Knuth at Quanta]](https://www.quantamagazine.org/computer-scientist-donald-knuth-cant-stop-telling-stories-20200416/)

### Fred Brooks

Essential complexity is inherent in the problem domain. Accidental complexity is what we create unnecessarily. Past breakthroughs (high-level languages, time-sharing, IDEs) all addressed accidental complexity. No single technique yields an order-of-magnitude improvement.

[[No Silver Bullet (PDF)]](https://worrydream.com/refs/Brooks_1986_-_No_Silver_Bullet.pdf)

### Andrew Kelley

"Avoid local maximums." Question foundational premises. 35% speed improvements from data layout optimization alone, no algorithmic changes. Make allocators explicit, first-class values.

> "The less memory is touched, the less pressure there will be on the CPU."

[[Kelley on Zig design (Sourcegraph)]](https://about.sourcegraph.com/blog/zig-programming-language-revisiting-design-approach) [[Kelley CoRecursive podcast]](https://corecursive.com/067-zig-with-andrew-kelley/)

### Bryan Cantrill

Platform values (approachability, debuggability, performance, robustness, simplicity...) conflict, and you must choose. The right language/platform is the one whose values align with your project's goals. Build observability tools as you need them.

[[Software as a Reflection of Values (CoRecursive)]](https://corecursive.com/024-software-as-a-reflection-of-values-with-bryan-cantrill/)

### Fabrice Bellard

Deep understanding of fundamentals enables one person to build what teams cannot. TinyGL in 8,000 lines. QEMU solo through v0.7.1. Discipline and tight feedback loops -- not genius -- explain extraordinary productivity.

[[Bellard's Performance Craft (Koder.ai)]](https://koder.ai/blog/fabrice-bellard-performance-craftsmanship-ffmpeg-qemu)

### Doug McIlroy

"Write programs that do one thing and do it well. Write programs to work together. Expect the output of every program to become the input to another, as yet unknown, program."

[[Unix philosophy (Wikipedia)]](https://en.wikipedia.org/wiki/Unix_philosophy)

### Butler Lampson

STEADY goals: Simple, Timely, Efficient, Adaptable, Dependable, Yummy. Have a spec. Get it right. Keep it clean. Don't hide power. Don't generalize prematurely. Good fences make good neighbors.

[[Hints and Principles for Computer System Design (arXiv)]](https://arxiv.org/abs/2011.02455)

### Chuck Moore

Three-fold principle: (1) Keep it simple, (2) Do not speculate -- never include unused code, (3) Do it yourself. Code should fit in 1KB blocks -- a quantum comprehensible on a single screen. Beautiful code is never larger than this.

> "Complexity is the problem. Moving it from hardware to software, or vice versa, doesn't help. Simplicity is the only answer."

[[Moore on Keeping It Simple (Simple Talk)]](https://www.red-gate.com/simple-talk/opinion/geek-of-the-week/chuck-moore-on-the-lost-art-of-keeping-it-simple/)

### Alan Kay

"OOP to me means only messaging, local retention and protection and hiding of state-process, and extreme late-binding of all things." The big idea is messaging, not objects. Design how modules communicate, not what they contain.

[[Alan Kay on OOP]](https://www.purl.org/stefan_ram/pub/doc_kay_oop_en) [[Deep Insights of Alan Kay]](https://mythz.servicestack.net/blog/2013/02/27/the-deep-insights-of-alan-kay/)

### Mike Pall

Optimize the interpreter first, then JIT compile only CPU-intensive parts. Keep the codebase astonishingly small. Understand what the target runtime can and cannot optimize.

[[Pall on interpreter optimization (HN)]](https://news.ycombinator.com/item?id=8605225)

### Jonathan Blow

"Most of the decisions I make in programming are aesthetic decisions." C++ is burdened with every idea ever introduced. Good tools should feel like C but shed its worst baggage: no silent errors, no complex build chains, no mysterious behaviors.

[[Blow on good design (Notion)]](https://www.notion.com/blog/jonathan-blow)

