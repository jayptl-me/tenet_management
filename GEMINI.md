# Agent entry (Gemini)

Full project instructions: **[AGENTS.md](./AGENTS.md)**

Load for multi-step work:

1. [docs/AGENT_CONTEXT.md](./docs/AGENT_CONTEXT.md) -- product split, paths, gates
2. [docs/PORTAL_CONNECTIVITY.md](./docs/PORTAL_CONNECTIVITY.md) -- CORS, auth, Flutter Web/iOS
3. [docs/audit/README.md](./docs/audit/README.md) -- open gaps

## Product split (do not violate)

- **Next.js `apps/web`:** admin only
- **Flutter `mobile/`:** tenant, guardian, visitor desk -- **Flutter Web + iOS + Android**
- **API `apps/api`:** shared HTTP backend

ASCII only. No emojis in agent output to the repo.
