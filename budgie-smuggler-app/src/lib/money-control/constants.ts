export const ACCOUNT_SOURCE_TYPES = ["plaid", "manual", "import"] as const;
export const USAGE_TYPES = ["personal", "business", "mixed", "unknown"] as const;
export const CASH_FLOW_ROLES = ["spending", "income", "transfer", "debt_payment", "interest", "fee", "refund", "other"] as const;
export const REVIEW_STATUSES = ["needs_review", "suggested", "confirmed", "accepted", "ignored"] as const;
export const ACTION_STATUSES = ["open", "snoozed", "done", "dismissed"] as const;
export const ACTION_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const AI_PURPOSES = ["classification", "brief", "chat", "extraction"] as const;
export const DEBT_TYPES = ["credit_card", "personal_loan", "business_loan", "line_of_credit", "medical", "tax", "other"] as const;
export const DEBT_SPENDING_STATUSES = ["active", "paused", "closed"] as const;
export const RECURRING_CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "yearly", "unknown"] as const;
export const RECURRING_STATUSES = ["suspected", "confirmed", "ignored", "cancelled"] as const;
export const RECURRING_SOURCES = ["rule", "manual"] as const;
export const MONEY_ACTION_TYPES = [
  "review_import",
  "complete_debt_details",
  "upcoming_debt_due",
  "high_utilization_debt",
  "debt_interest_pressure",
  "review_suspected_recurring",
  "review_price_increase",
  "review_cross_usage_recurring",
] as const;

export type AccountSourceType = (typeof ACCOUNT_SOURCE_TYPES)[number];
export type UsageType = (typeof USAGE_TYPES)[number];
export type CashFlowRole = (typeof CASH_FLOW_ROLES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export type AiPurpose = (typeof AI_PURPOSES)[number];
export type DebtType = (typeof DEBT_TYPES)[number];
export type DebtSpendingStatus = (typeof DEBT_SPENDING_STATUSES)[number];
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];
export type RecurringSource = (typeof RECURRING_SOURCES)[number];
export type MoneyActionType = (typeof MONEY_ACTION_TYPES)[number];
