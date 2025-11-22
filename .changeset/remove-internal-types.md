---
'markdown-to-jsx': major
---

Remove internal type definitions and rename `MarkdownToJSX.RuleOutput` to `MarkdownToJSX.ASTRender`

This change removes internal type definitions from the `MarkdownToJSX` namespace:

- Removed `NestedParser` type
- Removed `Parser` type
- Removed `Rule` type
- Removed `Rules` type
- Renamed `RuleOutput` to `ASTRender` for clarity

**Breaking changes:**

If you are using the internal types directly:

- Code referencing `MarkdownToJSX.NestedParser`, `MarkdownToJSX.Parser`, `MarkdownToJSX.Rule`, or `MarkdownToJSX.Rules` will need to be updated
- The `renderRule` option in `MarkdownToJSX.Options` now uses `ASTRender` instead of `RuleOutput` for the `renderChildren` parameter type
- `HTMLNode.children` type changed from `ReturnType<MarkdownToJSX.NestedParser>` to `ASTNode[]` (semantically equivalent, but requires updates if using the old type)
