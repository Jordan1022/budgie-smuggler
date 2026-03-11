import { PrismaClient } from "@prisma/client";
import { isDatabaseConfigured } from "@/lib/env";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = isDatabaseConfigured()
  ? global.__prisma ?? new PrismaClient({ log: ["warn", "error"] })
  : null;

if (process.env.NODE_ENV !== "production" && prisma) {
  global.__prisma = prisma;
}
