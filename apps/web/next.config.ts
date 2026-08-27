import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace package ships TypeScript source; transpile so runtime value
  // exports (e.g. STATUS_COLOR_MAP) resolve under Turbopack.
  transpilePackages: ['@pg/types'],
  typescript: {
    // Typecheck is strictly enforced via `bun run typecheck` (tsc --noEmit)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
