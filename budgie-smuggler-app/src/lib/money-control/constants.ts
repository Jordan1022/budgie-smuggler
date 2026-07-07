export const ACCOUNT_SOURCE_TYPES = ["plaid", "manual", "import"] as const;
export const USAGE_TYPES = ["personal", "business", "mixed", "unknown"] as const;
export const CASH_FLOW_ROLES = ["spending", "income", "transfer", "debt_payment", "interest", "fee", "refund", "other"] as const;
export const REVIEW_STATUSES = ["needs_review", "suggested", "confirmed", "accepted", "ignored"] as const;
export const ACTION_STATUSES = ["open", "snoozed", "done", "dismissed"] as const;
export const ACTION_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const AI_PURPOSES = ["classification", "brief", "chat", "extraction"] as const;

export type AccountSourceType = (typeof ACCOUNT_SOURCE_TYPES)[number];
export type UsageType = (typeof USAGE_TYPES)[number];
export type CashFlowRole = (typeof CASH_FLOW_ROLES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export type AiPurpose = (typeof AI_PURPOSES)[number];
