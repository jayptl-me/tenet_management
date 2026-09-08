# TypeScript 7 Compliance

> Policy and toolchain requirements for running this repo on TypeScript 7
> (the native, Go-based compiler). ASCII only. No emojis.

## Status

- TypeScript: `7.0.2` (root `package.json`, `apps/web` via `^7.0.0`)
- Next.js (admin web): `16.3.4` or newer (upgraded from `16.2.7` on 2026-09-08)
- All packages typecheck green on TS 7: `@pg/api`, `@pg/web`, `@pg/types`

## What TypeScript 7 is

TypeScript 7 is the native (Go-based) compiler. Unlike TypeScript 5/6, it
ships no classic JavaScript compiler API:

- The package `.` export maps to `lib/version.cjs` (version metadata only).
- `createProgram`, `transpileModule`, and `sys` are not exposed.
- `lib/typescript.js` (the classic API entry consumed by many tools) does
  not exist.
- The `tsc` binary (`bin/tsc.js`) works fully for CLI type checking
  (`tsc --noEmit`). This is what `bun run typecheck` uses.

## Why Next.js 16.2.7 failed

Next.js 16.2.7's `verifyTypeScriptSetup` requires the file
`typescript/lib/typescript.js`. With TS 7 installed that file is absent, so
Next concludes TypeScript is "not installed" and attempts an automatic
`npm install typescript`. npm cannot parse the `workspace:*` protocol used
by `@pg/types`, producing:

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

The stack never crashed because of missing dependencies; it crashed because
Next 16.2.7 predates TypeScript 7 support.

## Why Next.js 16.3.4 works

Next.js 16.3.4 added a TypeScript-CLI type checker
(`experimental.useTypeScriptCli`, default `true` in the shipped config).
Type checking runs the TS 7 `tsc` binary as a subprocess instead of loading
the JS API, and the required-package check drops to
`typescript/package.json` (which TS 7 ships). Reference: vercel/next.js
v16.3.4 release notes and shipped dist
(`dist/esm/server/config-shared.js`, `dist/esm/lib/verify-typescript-setup.js`).

## Rules

1. Never downgrade `typescript` below 7 in the root or in `apps/web`.
2. Never alias `typescript` to `npm:@typescript/typescript6` (the classic
   TS 6 compatibility line). It would silently move the web app off TS 7.
3. Never run `npm install` or `yarn install` in this repo. Bun only
   (`bun install`); npm cannot resolve `workspace:*`.
4. Keep `next` and `eslint-config-next` on the same version in
   `apps/web/package.json`.
5. In-Next build type checking is bypassed (`typescript.ignoreBuildErrors`
   in `apps/web/next.config.ts`). Strict typing is enforced by
   `bun run typecheck` (`tsc --noEmit` on TS 7). Keep that gate in CI.
6. Code must not import the `typescript` package's JS API (no
   `require('typescript')` / `from 'typescript'` anywhere in `apps/`,
   `packages/`, or `scripts/`).

## Verification commands

```
bun run typecheck                       # all workspaces on TS 7 tsc
bun run dev                             # API :8000 + admin :3000, no npm errors
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/
curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/v1/health
```

A clean dev boot shows `Next.js 16.3.4 (Turbopack)` / `Ready` with zero
occurrences of `EUNSUPPORTEDPROTOCOL` or
`required package(s) installed`.
