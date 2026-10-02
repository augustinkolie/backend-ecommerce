import type { Prisma } from "@/src/generated/prisma/client";
import type { AuthUser } from "./auth";
import { prisma } from "./prisma";

/** Journal d'audit : qui a modifié quoi, quand (avant/après en JSON). */
export async function audit(
  author: AuthUser | null,
  action: string,
  entityType: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.auditLog.create({
    data: {
      authorId: author?.id,
      action,
      entityType,
      entityId,
      before: before === undefined ? undefined : (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue),
      after: after === undefined ? undefined : (JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue),
    },
  });
}
