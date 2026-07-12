import { env } from './env.js';

/**
 * Resolve allowed CORS origins for the Hono API.
 *
 * Clients:
 * - Admin web (Next.js)  -> FRONTEND_URL (e.g. http://localhost:3000)
 * - Flutter portal web   -> PORTAL_URL or any localhost/127.0.0.1 in development
 * - Flutter mobile       -> no Origin header on native; CORS only matters for browser
 * - Capacitor (if used)  -> capacitor://localhost
 *
 * Production: only explicit URLs (FRONTEND_URL, PORTAL_URL, CORS_EXTRA_ORIGINS).
 * Development: those URLs plus any http://localhost:* / http://127.0.0.1:* origin
 * so Flutter web random ports work without constant env edits.
 */
export function resolveCorsOrigin(requestOrigin: string): string | undefined {
  const allowlist = buildAllowlist();

  if (allowlist.has(requestOrigin)) {
    return requestOrigin;
  }

  if (env.NODE_ENV !== 'production' && isLocalDevOrigin(requestOrigin)) {
    return requestOrigin;
  }

  return undefined;
}

function buildAllowlist(): Set<string> {
  const set = new Set<string>();

  if (env.FRONTEND_URL) set.add(stripTrailingSlash(env.FRONTEND_URL));
  if (env.PORTAL_URL) set.add(stripTrailingSlash(env.PORTAL_URL));

  for (const raw of env.CORS_EXTRA_ORIGINS) {
    const o = stripTrailingSlash(raw.trim());
    if (o) set.add(o);
  }

  // Common local defaults (dev + tooling)
  set.add('http://localhost:3000');
  set.add('http://localhost:5173');
  set.add('http://localhost:8080');
  set.add('http://127.0.0.1:3000');
  set.add('http://127.0.0.1:8080');
  set.add('capacitor://localhost');

  return set;
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
