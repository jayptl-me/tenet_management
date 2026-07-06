import { randomUUID } from 'node:crypto';

interface TokenEntry {
  jti: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

const tokensByJti = new Map<string, TokenEntry>();
const tokensByUser = new Map<string, Set<string>>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;

function addToken(userId: string, jti: string): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  tokensByJti.set(jti, { jti, userId, createdAt: now, expiresAt });

  const userTokens = tokensByUser.get(userId);
  if (userTokens) {
    userTokens.add(jti);
  } else {
    tokensByUser.set(userId, new Set([jti]));
  }
}

function removeToken(jti: string): boolean {
  const entry = tokensByJti.get(jti);
  if (!entry) return false;
  tokensByJti.delete(jti);
  const userTokens = tokensByUser.get(entry.userId);
  if (userTokens) {
    userTokens.delete(jti);
    if (userTokens.size === 0) tokensByUser.delete(entry.userId);
  }
  return true;
}

function isValidJti(userId: string, jti: string): boolean {
  const entry = tokensByJti.get(jti);
  if (!entry) return false;
  if (entry.userId !== userId) return false;
  if (entry.expiresAt < new Date()) {
    removeToken(jti);
    return false;
  }
  return true;
}

export function createRefreshToken(userId: string): string {
  const jti = randomUUID();
  addToken(userId, jti);
  return jti;
}

export function rotateRefreshToken(
  userId: string,
  oldJti: string,
): { newJti: string } | { error: 'REUSE_DETECTED' } {
  if (!tokensByJti.has(oldJti)) {
    return { error: 'REUSE_DETECTED' };
  }
  removeToken(oldJti);
  const newJti = randomUUID();
  addToken(userId, newJti);
  return { newJti };
}

export function revokeAllUserTokens(userId: string): number {
  const userTokens = tokensByUser.get(userId);
  if (!userTokens) return 0;
  let count = 0;
  for (const jti of userTokens) {
    tokensByJti.delete(jti);
    count++;
  }
  tokensByUser.delete(userId);
  return count;
}

export function verifyAndConsumeRefreshToken(userId: string, jti: string): boolean {
  if (!isValidJti(userId, jti)) return false;
  removeToken(jti);
  return true;
}

export function getTokenStoreStats(): { totalTokens: number; totalUsers: number } {
  return {
    totalTokens: tokensByJti.size,
    totalUsers: tokensByUser.size,
  };
}

setInterval(() => {
  const now = new Date();
  for (const [jti, entry] of tokensByJti) {
    if (entry.expiresAt < now) {
      removeToken(jti);
    }
  }
}, CLEANUP_INTERVAL).unref();
