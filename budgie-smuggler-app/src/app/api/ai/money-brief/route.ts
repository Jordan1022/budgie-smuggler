import { NextResponse } from "next/server";
import { buildMoneyContext } from "@/lib/ai/money-context";
import { generateMoneyBrief } from "@/lib/ai/grok";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

export async function POST() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const context = await buildMoneyContext(user.id);
  const result = await generateMoneyBrief(context);

  if (prisma) {
    await prisma.aiRun.create({
      data: {
        ownerUserId: user.id,
        provider: result.source === "xai" ? "xai" : "fallback",
        model: result.source === "xai" ? env().XAI_MODEL : "local-rules",
        purpose: "brief",
        redactionLevel: "standard",
        promptVersion: "money-brief-v1",
        inputSummary: result.redactionSummary,
        outputStatus: "completed",
      },
    });
  }

  return NextResponse.json(result);
}
