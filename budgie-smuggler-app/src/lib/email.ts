import { Resend } from "resend";
import { env, isEmailConfigured } from "@/lib/env";

export function createResendClient() {
  if (!isEmailConfigured()) {
    throw new Error("Resend is not configured.");
  }

  return new Resend(env().RESEND_API_KEY);
}

export function getAlertFromEmail() {
  const from = env().ALERT_FROM_EMAIL;
  if (!from) {
    throw new Error("ALERT_FROM_EMAIL is missing.");
  }

  return from;
}
