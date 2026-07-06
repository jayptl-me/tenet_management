# codebase-index-update-protocol.md

> Protocol for keeping codebase-index.md accurate and synchronized.

The index file is the source of truth for the codebase layout. This protocol defines when and how the index is updated.

## Trigger Events

An update to [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) is REQUIRED when:

1. A source file or directory is created, deleted, renamed, or relocated.
2. A new dependency is added, updated, or deleted in any `package.json`.
3. A Mongoose schema/model is added, modified, or removed.
4. A new cross-cutting concern is introduced (e.g. adding Redis caching, changing SSE connections, or switching CORS origins).

## Update Actions

1. **Modify Layout:** Update the ASCII directory structure representation. Keep it clean and follow standard indentation patterns.
2. **Modify Table Entries:** Add, remove, or edit rows in the Sub-Project Paths tables. Ensure that all listed file paths are absolute and clickable using `file:///` scheme.
3. **Cross-Cutting Concerns:** Update the key cross-cutting concerns mapping if code structures or services change locations.
4. **Database Collection Details:** Document any updates to database entities in the collections list.

## Token Efficiency Guidelines

To prevent the index from taking up too much of the context window:

- **Wildcard Summaries:** If a directory contains 20+ files that serve the same purpose (e.g. Next.js App Router route files or typescript entities), group them. For example: `apps/web/src/app/dashboard/**/*.tsx -> Dashboard components and UI sub-routes`.
- **Granular Lists:** If a directory contains distinct, isolated utilities (e.g. libraries or middleware configurations), list them individually.
- **No Implementation details:** Do not list function parameters, helper names, or internal variables inside the index. Limit descriptions to single-line purposes.

## Self-Healing Protocol

At the end of any complex pass:

1. Randomly select 3 file links from [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md).
2. Verify that these files exist on the filesystem.
3. If any path is broken, update the index immediately.
4. Verify that there are zero emojis in [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md).
