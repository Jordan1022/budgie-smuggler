import crypto from "node:crypto";
import { env } from "@/lib/env";

function getKey() {
  const source = env().DATA_ENCRYPTION_KEY;
  if (!source || source.length < 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be set and at least 32 characters.");
  }

  return crypto.createHash("sha256").update(source).digest();
}

export function encrypt(plaintext: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(payload: string) {
  const bytes = Buffer.from(payload, "base64");
  const iv = bytes.subarray(0, 12);
  const tag = bytes.subarray(12, 28);
  const encrypted = bytes.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
