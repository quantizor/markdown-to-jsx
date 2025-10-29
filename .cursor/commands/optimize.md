deeply inspect the code the user has indicated

perform the following analysis:

- code flow
- computational banding
- branching
- redundant work
- dead code
- cyclomatic complexity
- allocations & memory pressure
- overall code size in lines (excluding comments and whitespace)

determine the chokepoints in the code and resolve them, achieving net-negative LOC. simplify the code.
test after each change to ensure no regressions. 100% passing tests required.

use existing helpers when it makes sense, but do not use a helper that does more work than the original code.
