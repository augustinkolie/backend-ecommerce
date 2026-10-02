import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/src/generated/prisma/client";
import { COOKIE, readCookie } from "./cookies";
import { env } from "./env";
import { AppError } from "./errors";
import { can, type Permission } from "./rbac";

export const ACCESS_TTL = 15 * 60; // 15 min
export const REFRESH_TTL = 30 * 24 * 3600; // 30 jours

export type AuthUser = { id: string; role: Role; email: string };

const secret = () => new TextEncoder().encode(env().JWT_SECRET);

export const hashPassword = (password: string) => hash(password);
export const verifyPassword = (hashed: string, password: string) => verify(hashed, password).catch(() => false);

export async function signAccessToken(user: AuthUser) {
  return new SignJWT({ role: user.role, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: payload.sub!, role: payload.role as Role, email: payload.email as string };
  } catch {
    return null;
  }
}

export const randomToken = () => randomBytes(32).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Utilisateur authentifié (cookie `at`, ou en-tête Authorization: Bearer). */
export async function getAuth(req: Request): Promise<AuthUser | null> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || readCookie(req, COOKIE.access);
  return token ? verifyAccessToken(token) : null;
}

export async function requireUser(req: Request): Promise<AuthUser> {
  const user = await getAuth(req);
  if (!user) throw AppError.unauthorized();
  return user;
}

export async function requirePermission(req: Request, permission: Permission): Promise<AuthUser> {
  const user = await requireUser(req);
  if (!can(user.role, permission)) throw AppError.forbidden();
  return user;
}

export async function requireStaff(req: Request): Promise<AuthUser> {
  const user = await requireUser(req);
  if (user.role === "CUSTOMER") throw AppError.forbidden();
  return user;
}

export function isServiceRequest(req: Request) {
  const key = env().API_SERVICE_KEY;
  return !!key && req.headers.get("x-service-key") === key;
}
