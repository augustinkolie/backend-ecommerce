import { randomUUID } from "node:crypto";
import { createElement } from "react";
import type { User } from "@/src/generated/prisma/client";
import {
  ACCESS_TTL,
  hashPassword,
  randomToken,
  REFRESH_TTL,
  sha256,
  signAccessToken,
  verifyPassword,
} from "@/src/lib/auth";
import { clearCookie, COOKIE, readCookie, serializeCookie } from "@/src/lib/cookies";
import { env } from "@/src/lib/env";
import { AppError } from "@/src/lib/errors";
import { sendMail } from "@/src/lib/mail";
import { prisma } from "@/src/lib/prisma";
import { permissionsFor } from "@/src/lib/rbac";
import { getSettings } from "@/src/lib/settings";
import { MagicLink } from "@/src/emails/templates";
import { mergeGuestCart } from "../cart/service";

export function publicUser(u: Pick<User, "id" | "email" | "name" | "phone" | "role">) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, permissions: permissionsFor(u.role) };
}

/** Ouvre une session : jeton d'accès 15 min + refresh token rotatif, en cookies httpOnly. */
async function openSession(user: User, req: Request, familyId: string = randomUUID()) {
  if (user.blockedAt || user.deletedAt) throw AppError.forbidden("Ce compte est désactivé.");
  const access = await signAccessToken({ id: user.id, role: user.role, email: user.email });
  const refresh = randomToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: sha256(refresh), familyId, expiresAt: new Date(Date.now() + REFRESH_TTL * 1000) },
  });

  const headers = new Headers();
  headers.append("set-cookie", serializeCookie(COOKIE.access, access, ACCESS_TTL));
  headers.append("set-cookie", serializeCookie(COOKIE.refresh, refresh, REFRESH_TTL));

  const guestCart = readCookie(req, COOKIE.cart);
  if (guestCart) {
    await mergeGuestCart(guestCart, user.id);
    headers.append("set-cookie", clearCookie(COOKIE.cart));
  }
  return { headers, user: publicUser(user) };
}

export async function register(req: Request, input: { email: string; password: string; name: string; phone?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing?.passwordHash) throw AppError.conflict("Un compte existe déjà avec cet e-mail.");
  const passwordHash = await hashPassword(input.password);
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, name: input.name, phone: input.phone } })
    : await prisma.user.create({ data: { email: input.email, passwordHash, name: input.name, phone: input.phone } });
  return openSession(user, req);
}

export async function login(req: Request, input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = user?.passwordHash ? await verifyPassword(user.passwordHash, input.password) : false;
  if (!user || !valid) throw new AppError(401, "INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect.");
  return openSession(user, req);
}

export async function refresh(req: Request) {
  const token = readCookie(req, COOKIE.refresh);
  if (!token) throw AppError.unauthorized();
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.expiresAt < new Date()) throw AppError.unauthorized("Session expirée");
  if (row.revokedAt) {
    // Réutilisation d'un jeton déjà tourné : on révoque toute la famille.
    await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw AppError.unauthorized("Session révoquée");
  }
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return openSession(row.user, req, row.familyId);
}

export async function logout(req: Request) {
  const token = readCookie(req, COOKIE.refresh);
  if (token) {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (row) await prisma.refreshToken.updateMany({ where: { familyId: row.familyId }, data: { revokedAt: new Date() } });
  }
  const headers = new Headers();
  headers.append("set-cookie", clearCookie(COOKIE.access));
  headers.append("set-cookie", clearCookie(COOKIE.refresh));
  return headers;
}

export async function requestMagicLink(email: string) {
  const token = randomToken();
  await prisma.magicLinkToken.create({
    data: { email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 15 * 60_000) },
  });
  const { shopName } = await getSettings();
  const url = `${env().FRONTEND_URL}/connexion/lien?token=${token}`;
  await sendMail(email, `Votre lien de connexion — ${shopName}`, createElement(MagicLink, { shopName, url }));
}

export async function verifyMagicLink(req: Request, token: string) {
  const row = await prisma.magicLinkToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw AppError.unauthorized("Lien expiré ou déjà utilisé.");
  await prisma.magicLinkToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  const user = await prisma.user.upsert({ where: { email: row.email }, create: { email: row.email }, update: {} });
  return openSession(user, req);
}
