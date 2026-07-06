# adaptive-research-protocol.md

> Guidelines for progressive knowledge acquisition and anti-hallucination standards.

Always base answers and solutions on concrete codebase patterns, verified documentation, or test outcomes. Never guess.

## Phase 0: Parse User Intent

Classify the user request into one of the following intent classes to choose the primary source:

| Intent Class              | Primary Source                                                                                                                                                  | Fallback Source                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code Modification         | Codebase Index + Local files                                                                                                                                    | [monorepo-boundaries.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/monorepo-boundaries.md) |
| Bug Fix / Error           | Stack traces + Local logs                                                                                                                                       | Web search (exact error message)                                                                                                                      |
| New Feature               | Existing feature implementations                                                                                                                                | Web search (best practices for libraries)                                                                                                             |
| Architecture / Dependency | Root package.json / Base configs                                                                                                                                | Web search (framework guidelines)                                                                                                                     |
| Database / Schema change  | [database-schema-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/database-schema-protocol.md) | Mongoose documentation                                                                                                                                |
| Testing / Verification    | `.github/workflows/ci.yml` / scripts                                                                                                                            | Vitest / Playwright docs                                                                                                                              |
| Unknown / Ambiguous       | Targeted codebase search                                                                                                                                        | Ask user for clarification                                                                                                                            |

## Phase 1: Codebase-First Search

Before using any external tools or performing web searches, complete these steps:

1. Load [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) to locate the target directories.
2. Read the files most likely to contain relevant logic (e.g. models when changing properties, routes when changing endpoints).
3. Use exact text matches (ripgrep / grep_search) to locate similar code patterns already in use (e.g. searching how CORS or authentication middleware is structured).
4. Identify export dependencies (e.g. checking what modules import from `@pg/types`).

### Stop Condition

- If an existing pattern is found that solves the problem -> Proceed immediately to the Plan phase.

## Phase 2: Budget-Aware Web Search

Use web search only when local resources are insufficient.

### Search Criteria

- When a library API is unknown or undocumented in the codebase (e.g. specific Next.js 16 parameters or Hono context properties).
- When a compiler or runtime error message is ambiguous and local troubleshooting fails.
- When researching standard security protocols or best practice checklists (e.g. safe MongoDB index creation).

### Search Parameters

- Always enforce search parameters:
  - `search_depth: basic`
  - `max_results: 5`
  - Do NOT pass parameters requesting full-page contents or raw page bodies unless necessary.
- Budget Check: Keep total queries below 5 per session.

## Phase 3: Sub-Agent Research Delegation

For large, unfamiliar, or isolated directories:

- Delegate investigation to a sub-agent when you need an overview of a sub-project without using up your main context window.
- The sub-agent must follow the rules in [sub-agent-orchestration.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/sub-agent-orchestration.md).

## Phase 4: Knowledge Synthesis

Before starting any implementation plan, synthesize your findings:

1. **Verified facts:** Code paths, schemas, and commands that have been read directly.
2. **Assumptions:** Things you believe to be true but have not verified (e.g. "MongoDB is running locally").
3. **Gaps:** What is missing to complete the task.
4. **Action choice:** Proceed to planning, gather more research, or ask the user.

## Anti-Hallucination Checklist

Do not write code until you can answer YES to every item:

- [ ] Have I verified that all imported packages exist in the project `package.json` files?
- [ ] Have I checked that the functions/methods I am calling are defined with those signatures in the target files?
- [ ] Have I verified that the database property names match the Mongoose schema exactly?
- [ ] Have I confirmed that the build and runtime environment is Bun (rather than Node or Deno)?
