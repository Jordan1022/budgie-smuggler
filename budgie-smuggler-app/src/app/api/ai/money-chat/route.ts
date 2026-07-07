import { NextResponse } from "next/server";
import { z } from "zod";
import { logAiRun } from "@/lib/ai/audit";
import { answerMoneyQuestion } from "@/lib/ai/grok";
import { buildMoneyContext } from "@/lib/ai/money-context";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

const chatSchema = z.object({
  question: z.string().trim().min(1).max(1000),
});

export async function POST(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const context = await buildMoneyContext(user.id);
  const result = await answerMoneyQuestion(context, parsed.data.question);

  logAiRun({
    ownerUserId: user.id,
    source: result.source,
    purpose: "chat",
    promptVersion: "money-chat-v1",
    redactionSummary: result.redactionSummary,
  });

  return NextResponse.json(result);
}
