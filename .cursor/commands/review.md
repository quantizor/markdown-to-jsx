Whole-branch review focused on systemic issues, coverage gaps, and subtle problems spanning multiple files.

Review changed files holistically. Identify:

Coverage gaps: Untested paths, edge cases, integration scenarios. Reject assertions that only check existence (toBeTruthy, toBeDefined).

Cross-file issues: Inconsistent patterns, missing/duplicated shared logic, type/interface mismatches, import problems.

Best practices: Repository rules, adapter patterns (React/RN/HTML/Markdown), TypeScript (no any), performance (ES5, bundle size, tree shaking).

Logic bugs: Unhandled edge cases, off-by-one errors, async/race conditions, state inconsistencies, boundary failures.

Process: Analyze diff scope, review coverage, check cross-file consistency, verify best practices, identify subtle bugs, document fixes.

Validate: bun test passes, assertions validate shape+content, coverage 80%+ for changed code.
