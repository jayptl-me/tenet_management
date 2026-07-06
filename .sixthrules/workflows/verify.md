# Monorepo Verification Override

> **Loaded alongside universal code-quality-verification-gates.md when $STACK = monorepo.**

---

## Stack-Specific Commands

```yaml
type_check: bun run typecheck (or turbo run typecheck / npx tsc --noEmit --project tsconfig.json)
build: bun run build (or turbo run build / nx run-many --target=build)
test: bun test (or turbo run test / nx run-many --target=test)
lint: bun run lint (or turbo run lint)
dev: bun run dev (or turbo run dev)
format: bun run format
```

## Monorepo-Specific Gate Overrides

### Gate 1: Type Safety

```
bun run typecheck (or package-level tsc --noEmit)
□ Zero type errors across ALL packages
□ No cross-package type leaks (private types stay internal)
□ Shared types package exports only what's needed
□ Each package's tsconfig.json is correct
□ No circular dependencies between packages
```

### Gate 2: Import Integrity (Monorepo-specific)

```
□ All cross-package imports use workspace protocol (workspace:* or ^workspace:)
□ No imports of packages not listed in workspace dependencies
□ No deep imports into another package's internals (only public API)
□ Package boundaries enforced (no cross-contamination)
□ Each package has a clear index.ts (barrel) export
```

### Gate 3: Build

```
bun run build (or turbo run build)
□ All packages build in dependency order
□ No missing workspace dependencies
□ No bundle includes external node_modules it shouldn't
□ Build artifacts not committed (dist/, .next/, build/)
□ Build caching works correctly (if using Turborepo/Nx)
```

### Gate 4: Tests

```
bun test (or turbo run test)
□ All packages' tests pass
□ Test isolation: no shared state between package tests
□ No flaky integration tests between packages
```

### Gate 7: Integration Completeness (Monorepo-specific)

```
□ New package → added to workspace config (turbo.json, nx.json, or root package.json workspaces)
□ Shared config (tsconfig base, eslint config, prettier) extends correctly
□ New package's build output is referenceable by dependents
□ No dead packages (unused workspace entries)
□ CI pipeline includes new package
□ Changeset or versioning configured for publishable packages
```

### Gate 9: Code Quality (Monorepo-specific)

```
□ Consistent dependency versions across packages (no duplicate versions of same lib)
□ Root package.json only has devDependencies and shared tooling
□ .env.example at root (not per-package unless needed)
□ Shared lint/format config at root
□ No package-specific tooling that duplicates root config
□ Each package has a clear README with its purpose
```

## Skill Activation for Monorepo Projects

- `senior-architect` — Monorepo architecture, package boundaries
- `senior-devops` — CI/CD, build caching, deployment
- `senior-fullstack` — Full-stack patterns across packages
- `senior-qa` — Testing across packages
- `code-reviewer` — Code review across the monorepo
- `tdd-guide` — TDD across package boundaries
