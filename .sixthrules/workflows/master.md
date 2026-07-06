# master.md

> Root execution engine and router for all agent operations.

This workflow is loaded at the beginning of every turn. It determines the classification of the request, directs to the appropriate protocol, checks the state machine, and implements the per-turn validation checklist.

## Workflow File Map

All operations must align with the corresponding workflow instructions:

| File Name                                                                                                                                                                     | Purpose                                               | Activation Trigger                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| [master.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/master.md)                                                   | Entry routing, turn checklist, global state machine   | Every turn start                           |
| [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md)                                   | High-level index of the files and concerns            | Loaded on research phases                  |
| [automation-loop.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/automation-loop.md)                                 | The core Research-Plan-Execute-Verify loop            | Any task involving code changes            |
| [adaptive-research-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/adaptive-research-protocol.md)           | Multi-layered codebase and web search protocol        | Code discovery or debugging                |
| [sub-agent-orchestration.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/sub-agent-orchestration.md)                 | Coordination and contracts for sub-agents             | Multi-domain/parallel features             |
| [multi-pass-batch-planning.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/multi-pass-batch-planning.md)             | Decomposition of complex features into steps          | Medium to large size additions             |
| [code-quality-verification-gates.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/code-quality-verification-gates.md) | Strict validation checklist for completed work        | Before attempting completion               |
| [codebase-index-update-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index-update-protocol.md)   | Sync protocol for codebase-index.md                   | Any file structure changes                 |
| [monorepo-boundaries.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/monorepo-boundaries.md)                         | Enforces package encapsulation and workspace links    | Monorepo structure work / shared type sync |
| [database-schema-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/database-schema-protocol.md)               | Mongoose schema updates and data backfills            | Mongoose models or data seeding            |
| [deployment-verification.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/deployment-verification.md)                 | Verification of Render deployments and GitHub Actions | CI/CD changes or builds                    |

## State Machine

```
   +---------------------------------------+
   |                 IDLE                  |
   +---------------------------------------+
                       |
                       | (User Request Received)
                       v
   +---------------------------------------+
   |             ROUTING (1)               |
   +---------------------------------------+
                       |
                       +---------------+---------------+
                       |               |               |
                       |               |               |
                       v               v               v
   +-----------------------+   +---------------+   +-----------------------+
   |  RESEARCH & PLAN (2)  |   |   ANSWER (3)  |   |  BUG DIAGNOSIS (4)    |
   +-----------------------+   +---------------+   +-----------------------+
               |                       |                       |
               | (Plan Approved)       | (Direct Response)     | (Root Cause Found)
               v                       |                       v
   +-----------------------+           |           +-----------------------+
   |      EXECUTE (5)      |           |           |    FIX & VERIFY (6)   |
   +-----------------------+           |           +-----------------------+
               |                       |                       |
               | (Pass Verification)   |                       | (Pass Verification)
               +                       |                       +
               |                       v                       |
               |               +---------------+               |
               +-------------> |   VERIFY GATES|<--------------+
                               +---------------+
                                       |
                                       | (Gates Pass)
                                       v
                               +---------------+
                               |  DONE/ITERATE |
                               +---------------+
```

## Decision Engine

At the start of every turn:

1. Parse the user request.
2. Load [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) to understand which domains of the codebase are targeted.
3. Classify the task and route to the correct protocol using the Router.

## Protocol Router

- **Request is a Question / Code Investigation:**
  - Route to [adaptive-research-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/adaptive-research-protocol.md) Phase 0.
  - Read files and respond directly. Do not make code changes.

- **Request is a Simple Code Change (1-3 files, single sub-project):**
  - Route to [automation-loop.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/automation-loop.md).
  - Execute sequentially, run `bun run typecheck` + `bun run lint`.

- **Request is a Medium/Large Feature (multi-domain or cross-cutting changes):**
  - Route to [multi-pass-batch-planning.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/multi-pass-batch-planning.md).
  - Define passes, run sub-agents if needed via [sub-agent-orchestration.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/sub-agent-orchestration.md).

- **Request involves Mongoose Models, Data Seed, Schema updates:**
  - Route to [database-schema-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/database-schema-protocol.md).
  - Enforce backward compatibility, version validations, and test with `bun run seed`.

- **Request involves Monorepo setup, typescript package references:**
  - Route to [monorepo-boundaries.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/monorepo-boundaries.md).

- **Request is a Bug Fix / Error Report:**
  - Locate trace/logs. Check [adaptive-research-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/adaptive-research-protocol.md).
  - Root cause analysis: inspect schemas, controllers, and tests.
  - Attempt maximum 3 fixes on the same line/block before aborting to re-research.

- **Request involves Deployments, Render configuration, or CI Actions:**
  - Route to [deployment-verification.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/deployment-verification.md).

## Quick Reference Limits

- **Credit Budget:** Each session has a budget limit. Avoid redundant web searches. Check codebase first.
- **Web Search Config:** Always use `search_depth: basic` and `max_results: 5` (never fetch full answers raw).
- **Sub-Agent Spawns:** Max 2 concurrent sub-agents allowed. Each sub-agent must have a strict input/output file contract.

## Per-Turn Checklist

- [ ] Check if codebase layout has changed. If so, update [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md).
- [ ] Confirm no emojis are used in code edits, comments, or workflow logs.
- [ ] Confirm the target files are re-read prior to editing.
- [ ] Verify that new imports do not bypass package boundaries defined in [monorepo-boundaries.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/monorepo-boundaries.md).
