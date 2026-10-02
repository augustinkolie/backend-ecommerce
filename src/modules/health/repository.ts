import { prisma } from "@/src/lib/prisma";

export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
