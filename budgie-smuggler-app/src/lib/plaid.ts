import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { env, isPlaidConfigured } from "@/lib/env";

export function createPlaidClient() {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured.");
  }

  const parsed = env();
  const configuration = new Configuration({
    basePath: PlaidEnvironments[parsed.PLAID_ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": parsed.PLAID_CLIENT_ID,
        "PLAID-SECRET": parsed.PLAID_SECRET,
      },
    },
  });

  return new PlaidApi(configuration);
}
