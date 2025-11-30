We need to add an integration for the user-provided output format. This should be a separate entry point sibling to index.tsx, react.tsx, etc. It should be added to bunup.config.ts and the exports defined in package.json. Documentation should be added to README.md in the entry point section, and also any options customizations for that output. It should follow the same general pattern as the other entry points (exported parser, compiler, types, common utils, astTo{output} function). For outputs with a view library, ensure it is added as an optional peer dependency and dev dependency. Peer dependency ranges should be permissive.

Support every option that makes sense for the output format. If an option is not supported, it should be marked as optional+never in the exposed option type for that integration and be noted in the documentation. Add the target to `scripts/metrics.ts`.

Exhaustively research the current-year best practices for the output format. Start with tests, then implement the functionality. Bring in testing helpers like `@testing-library/*` if needed. Create a plan with code snippets and supporting details/visualizations to guide the implementation.

Ask any clarifying questions, focusing on the developer experience.
