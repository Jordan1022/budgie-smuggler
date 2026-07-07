import { NextResponse } from "next/server";
import { z } from "zod";
import { answerMoneyQuestion } from "@/lib/ai/grok";
import { buildMoneyContext } from "@/lib/ai/money-context";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
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

  if (prisma) {
    await prisma.aiRun.create({
      data: {
        ownerUserId: user.id,
        provider: result.source === "xai" ? "xai" : "fallback",
        model: result.source === "xai" ? env().XAI_MODEL : "local-rules",
        purpose: "chat",
        redactionLevel: "standard",
        promptVersion: "money-chat-v1",
        inputSummary: result.redactionSummary,
        outputStatus: "completed",
      },
    });
  }

  return NextResponse.json(result);
}
