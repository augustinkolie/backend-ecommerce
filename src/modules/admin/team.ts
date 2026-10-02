import { z } from "zod";
import { audit } from "@/src/lib/audit";
import { hashPassword, randomToken, type AuthUser } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import { prismaPage, toPage } from "@/src/lib/pagination";
import { prisma } from "@/src/lib/prisma";
import { STAFF_ROLES } from "@/src/lib/rbac";

export const staffBody = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  name: z.string().trim().min(1).max(120),
  role: z.enum(STAFF_ROLES),
});

export const staffPatch = z.object({
  role: z.enum(STAFF_ROLES).optional(),
  active: z.boolean().optional(),
});

export const auditQuery = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  authorId: z.string().optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listStaff() {
  const rows = await prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: !u.blockedAt,
    createdAt: u.createdAt,
  }));
}

/** Crée un compte d'équipe avec mot de passe provisoire (affiché une seule fois). */
export async function createStaff(input: z.infer<typeof staffBody>, author: AuthUser) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing && existing.role !== "CUSTOMER") throw AppError.conflict("Ce membre existe déjà.");
  const temporaryPassword = randomToken().slice(0, 14);
  const passwordHash = await hashPassword(temporaryPassword);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { role: input.role, name: input.name, passwordHash },
      })
    : await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          passwordHash,
        },
      });
  await audit(author, "team.create", "User", user.id, undefined, {
    email: user.email,
    role: user.role,
  });
  return { id: user.id, email: user.email, role: user.role, temporaryPassword };
}

export async function updateStaff(id: string, input: z.infer<typeof staffPatch>, author: AuthUser) {
  if (id === author.id) throw AppError.badRequest("Vous ne pouvez pas modifier votre propre rôle.");
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before || before.role === "CUSTOMER") throw AppError.notFound("Membre introuvable");
  if (before.role === "OWNER" && ((input.role && input.role !== "OWNER") || input.active === false)) {
    const owners = await prisma.user.count({
      where: { role: "OWNER", blockedAt: null, deletedAt: null },
    });
    if (owners <= 1) throw AppError.badRequest("Il doit rester au moins un propriétaire actif.");
  }
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: {
        role: input.role,
        blockedAt: input.active === undefined ? undefined : input.active ? null : new Date(),
      },
    });
    if (input.active === false || input.role) {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await audit(author, "team.update", "User", id, { role: before.role, active: !before.blockedAt }, { role: u.role, active: !u.blockedAt }, tx);
    return u;
  });
  return { id: user.id, role: user.role, active: !user.blockedAt };
}

export async function listAudit(q: z.infer<typeof auditQuery>) {
  const where = {
    entityType: q.entityType,
    entityId: q.entityId,
    authorId: q.authorId,
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...prismaPage(q, q.limit),
      include: { author: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return toPage(rows, q.limit, total, q.page);
}
