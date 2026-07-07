import { prisma } from "@/lib/prisma";

export type ActionItemInput = {
  type: string;
  title: string;
  body?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  dueDate?: Date | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  source?: "system" | "rule" | "ai";
};

export async function createActionItems(userId: string, items: ActionItemInput[]) {
  if (!prisma || items.length === 0) {
    return { created: 0, source: prisma ? ("database" as const) : ("mock" as const) };
  }

  await prisma.actionItem.createMany({
    data: items.map((item) => ({
      ownerUserId: userId,
      type: item.type,
      title: item.title,
      body: item.body ?? null,
      priority: item.priority ?? "normal",
      dueDate: item.dueDate ?? null,
      relatedEntityType: item.relatedEntityType ?? null,
      relatedEntityId: item.relatedEntityId ?? null,
      source: item.source ?? "system",
    })),
  });

  return { created: items.length, source: "database" as const };
}

export async function getOpenActionItems(userId: string, limit = 20) {
  if (!prisma) {
    return [
      {
        id: "mock-import-review",
        type: "review_import",
        title: "Review 8 imported transactions",
        body: "Sample mode shows what the money inbox will look like.",
        priority: "high",
        dueDate: null,
        relatedEntityType: "import_batch",
        relatedEntityId: null,
        source: "system",
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const priorityRank: Record<string, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  const rows = await prisma.actionItem.findMany({
    where: { ownerUserId: userId, status: "open" },
    orderBy: [{ createdAt: "asc" }],
    take: Math.max(limit * 2, limit),
  });

  return rows
    .sort((left, right) => (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      priority: row.priority,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
    }));
}
