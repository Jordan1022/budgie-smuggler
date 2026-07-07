import { NextResponse } from "next/server";
import { logAiRun } from "@/lib/ai/audit";
import { buildMoneyContext } from "@/lib/ai/money-context";
import { generateMoneyBrief } from "@/lib/ai/grok";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

export async function POST() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const context = await buildMoneyContext(user.id);
  const result = await generateMoneyBrief(context);

  logAiRun({
    ownerUserId: user.id,
    source: result.source,
    purpose: "brief",
    promptVersion: "money-brief-v1",
    redactionSummary: result.redactionSummary,
  });

  return NextResponse.json(result);
}
