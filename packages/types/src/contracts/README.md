# Module contracts

A contract is the written agreement between what the operator believes, what the server
actually commits, what the screen shows and where the work goes next.

## What a contract holds

- `canonicalLoop` - what the operator is doing here, what "done" looks like, the one primary
  action.
- `stateMachine` - every status, the inbound trigger that sets it, the target dwell, the dead
  end.
- `truthContract` - per action: what the operator believes, what the server commits, how a
  mismatch surfaces, where the provenance lives, what a stuck state means, the 3am runbook step.
- `layout` - the archetype, the grammar tokens, what it must not look like, its own number.
- `nextBestAction` - the next action per status and per empty state, each pointing at a real
  screen.

## How to fill one in

1. Copy the shape from `payments.ts`.
2. Read every anchor out of source, never out of memory: statuses from the model
   (`apps/api/src/models`), routes from the API route file (`apps/api/src/routes`), screens
   from `apps/web/src/app/(admin)`.
3. Keep every anchor resolvable. The checker fails a contract when:
   - a route path does not exist in the Hono route table;
   - a declared status is not in the model enum, or no route in the domain can write it;
   - a status has no `enteredBy` trigger;
   - a next best action target does not resolve to an admin page;
   - a state change owes a notification (`notification.required`) and neither the domain route
     file nor the modules that route file imports calls `createNotification`;
   - the layout archetype is not one of the allowed archetypes, or a grammar token does not
     exist in `apps/web/src/components/ui`.
4. Register the contract in `scripts/audit/check-contracts.ts`.
5. If a known gap cannot be closed yet, add one line to `baseline.ts` with the reason. The
   checker reports it as `BASELINE` instead of hiding it.

## The gate for a rebuilt module

"This contract exists and its checker passes." A module without a contract cannot be called
rebuilt, no matter how many components it has.

## Running the checker

From the repo root:

```
bun scripts/audit/check-contracts.ts
```

It reads the contracts and the live code from disk. It starts no server, needs no database and
touches no file. Exit code 0 means clean, exit code 1 means at least one contract failed.
