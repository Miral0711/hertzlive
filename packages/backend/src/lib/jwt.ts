import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from './env';

export interface AuthTokenPayload {
  sub: string; // user id
  role: string;
  email: string;
  organizationId: string;
}

export const signToken = (payload: AuthTokenPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] });

export const verifyToken = (token: string): AuthTokenPayload => jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
