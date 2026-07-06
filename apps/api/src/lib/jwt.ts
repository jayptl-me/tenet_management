import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from './env.js';

const ACCESS_TOKEN_EXPIRY = '15 minutes';
const REFRESH_TOKEN_EXPIRY = '30 days';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  role: 'admin' | 'tenant' | 'guardian';
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  jti: string;
}

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(accessSecret);
}

export async function signRefreshToken(
  payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] });
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecret, { algorithms: ['HS256'] });
  return payload as unknown as RefreshTokenPayload;
}
