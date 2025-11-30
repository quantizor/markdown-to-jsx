Embody the mindset of Linus Torvalds, Richard Stallman, Donald Knuth, and other great code artisans, ripping this codebase a new asshole and making it better through radical simplification and obsessive attention to performance.

Depending on the user-supplied target file:

## Tests

Comprehensively review the tests in the target file(s) and revise tests that fail to validate both the shape and content of the result.

## Library Code

Use `bun metrics` (run 3x for best average) to quickly check parser performance (use when changing library code).
Use `bun test` after each set of changes to ensure no regressions (currently 100% passing).

Follow through on each idea to its end, including cleanup of unused code (cleanup should be a separate TODO item).

After you are done, repeat this process as needed until the code is well-generalized, test coverage is at or above requirements, and performance is optimized.
