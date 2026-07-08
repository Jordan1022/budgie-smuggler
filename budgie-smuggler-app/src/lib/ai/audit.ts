import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { RedactionSummary } from "@/lib/ai/redaction";

export function logAiRun({
  ownerUserId,
  source,
  purpose,
  promptVersion,
  redactionSummary,
}: {
  ownerUserId: string;
  source: "xai" | "fallback";
  purpose: "brief" | "chat";
  promptVersion: string;
  redactionSummary: RedactionSummary;
}) {
  if (!prisma) {
    return;
  }

  try {
    void prisma.aiRun
      .create({
        data: {
          ownerUserId,
          provider: source === "xai" ? "xai" : "fallback",
          model: source === "xai" ? env().XAI_MODEL : "local-rules",
          purpose,
          redactionLevel: "standard",
          promptVersion,
          inputSummary: redactionSummary,
          outputStatus: "completed",
        },
      })
      .catch((error) => {
        console.error("Failed to persist AI audit run.", error);
      });
  } catch (error) {
    console.error("Failed to start AI audit persistence.", error);
  }
}
