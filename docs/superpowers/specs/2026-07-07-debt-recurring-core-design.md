# Debt and Recurring Core Design

Date: 2026-07-07
Project: Budgie Smuggler

## Purpose

This slice adds the financial backbone missing from the first manual-import release: debt accounts, recurring payments, subscription detection, debt pressure warnings, and concrete Today actions. It should make Budgie Smuggler understand what is owed, what is repeating, and what needs a decision before the app can produce higher-value reports, reminders, AI briefs, and chat.

The product rule remains:

> The ledger is authoritative. AI can suggest and explain, but reviewed app data drives financial truth.

## Scope

Build:

- Debt account tracking for credit cards, loans, and lines of credit.
- Manual debt account creation/editing tied to an existing account when available.
- Debt fields: balance, APR, minimum payment, due date, statement close date, credit limit, promo APR, promo expiration, usage type, spending status.
- Debt calculations: utilization, monthly interest estimate, minimum-payment pressure, missing-info warnings, and simple payoff priority.
- Recurring item tracking for subscriptions, bills, and recurring vendors.
- Recurring detection from accepted ledger transactions.
- Recurring statuses: suspected, confirmed, ignored, cancelled.
- Recurring amount/cadence detection and increase flags.
- Today action items for debt and recurring decisions.
- `/debt` and `/recurring` app pages.
- API routes and service functions needed by those pages.
- Focused tests for debt calculations, recurring detection, and action item creation.

Do not build in this slice:

- Full AI chat.
- Daily or weekly Grok brief.
- PDF statement parsing.
- Delivered email/push/SMS reminders.
- Full reporting dashboard.
- Tax/accounting features.
- Automated bill pay or payment initiation.

## User Outcomes

After this slice, the user should be able to:

- Add a credit card or debt account with APR, minimum payment, due date, limit, and balance.
- See which debts are missing important details.
- See total debt, total minimum payments, utilization, and high-pressure accounts.
- See blunt warnings for cards moving the wrong way or missing payoff data.
- Detect likely subscriptions and recurring bills from accepted transactions.
- Confirm, ignore, or cancel recurring items.
- See recurring monthly cost and suspected subscriptions needing review.
- Open Today and see debt/recurring tasks that say exactly what to do.

## Data Model

### DebtAccount

New table: `debt_accounts`

Fields:

- `id`
- `owner_user_id`
- `bank_account_id` nullable, references `bank_accounts`
- `name`
- `debt_type`: credit_card, loan, line_of_credit, other
- `usage_type`: personal, business, mixed, unknown
- `balance`
- `apr`
- `minimum_payment`
- `payment_due_day`
- `next_due_date`
- `statement_close_day`
- `credit_limit`
- `promo_apr`
- `promo_apr_expires_on`
- `spending_status`: active, frozen, unknown
- `last_payment_amount`
- `last_payment_date`
- `last_statement_balance`
- `notes`
- `created_at`
- `updated_at`

Rules:

- `balance`, `minimum_payment`, and `credit_limit` are stored as decimal money values.
- `apr` and `promo_apr` are annual percentages such as `29.99`, not fractions.
- `payment_due_day` and `statement_close_day` are integers from 1 to 31.
- `next_due_date` is a date and should be used for action item due dates.
- Debt accounts are owner-scoped like all other financial data.

### RecurringItem

New table: `recurring_items`

Fields:

- `id`
- `owner_user_id`
- `merchant_name`
- `normalized_merchant_key`
- `usage_type`: personal, business, mixed, unknown
- `category_id` nullable
- `amount_min`
- `amount_max`
- `typical_amount`
- `cadence`: weekly, biweekly, monthly, quarterly, yearly, irregular
- `next_expected_date`
- `last_seen_date`
- `transaction_count`
- `status`: suspected, confirmed, ignored, cancelled
- `price_increase_detected`
- `increase_amount`
- `source`: system, ai, manual
- `created_at`
- `updated_at`

Rules:

- Recurring detection only uses accepted ledger transactions.
- Suspected items do not become """confirmed""" without user action.
- Ignored/cancelled items remain stored so the app can avoid repeatedly asking about the same vendor.

### RecurringTransactionLink

New table: `recurring_transaction_links`

Fields:

- `id`
- `owner_user_id`
- `recurring_item_id`
- `transaction_id`
- `created_at`

Rules:

- Unique by `owner_user_id`, `recurring_item_id`, `transaction_id`.
- Used to explain why an item was detected and support future reports.

## Debt Calculations

### Utilization

For credit cards and lines of credit:

`utilization = balance / credit_limit * 100`

If limit is missing or zero, utilization is unknown and should create a missing-info action item.

Warning thresholds:

- 50%: caution
- 80%: high
- 100%: over-limit or maxed out

### Interest Estimate

Approximate monthly interest:

`monthlyInterest = balance * (apr / 100 / 12)`

If APR is missing, show """APR missing; payoff pressure is incomplete."""

### Minimum Payment Pressure

Classify each debt:

- `missing_info`: balance, APR, minimum payment, or due date missing.
- `urgent`: due date within 3 days or utilization >= 100.
- `high`: utilization >= 80 or monthly interest estimate is greater than minimum payment.
- `normal`: has required data and no high-risk flags.

Blunt messages:

- """Minimum payment only is not a plan."""
- """APR is missing, so payoff advice is incomplete."""
- """This card is over 80% utilization."""
- """This balance is high enough that interest is eating the payment."""

### Simple Payoff Priority

For now, recommend the highest APR debt among debts with required data. If APR is missing on any debt, include a warning that the recommendation is incomplete.

This is not a full payoff simulator. That belongs in a later reporting/planning slice.

## Recurring Detection

Detection runs over accepted ledger transactions grouped by normalized merchant key and usage type.

Candidates:

- At least 2 transactions for the same normalized merchant.
- Similar amounts within a configurable tolerance.
- Dates matching a plausible cadence:
  - weekly: 6 to 8 days apart
  - biweekly: 13 to 15 days apart
  - monthly: 27 to 35 days apart
  - quarterly: 80 to 100 days apart
  - yearly: 350 to 380 days apart

Amount tolerance:

- Exact amount match is high confidence.
- Up to 10% variation is medium confidence.
- Larger variation can still be a bill but should stay suspected with lower confidence.

Price increase:

- If the latest amount is higher than the previous typical amount by at least 10% and at least $2, flag `price_increase_detected`.

Status behavior:

- New candidates are `suspected`.
- User can confirm, ignore, or mark cancelled.
- Confirmed items stay visible in the recurring dashboard.
- Ignored items are not shown in the default list unless filtered.

## Today Actions

Debt actions:

- `complete_debt_details`: missing APR, minimum payment, limit, balance, or due date.
- `upcoming_debt_due`: payment due within 7 days.
- `high_utilization_debt`: card over 80% utilization.
- `debt_interest_pressure`: estimated monthly interest is greater than or close to minimum payment.

Recurring actions:

- `review_suspected_recurring`: suspected subscriptions or recurring bills need decision.
- `review_price_increase`: confirmed or suspected recurring item increased materially.
- `review_cross_usage_recurring`: business recurring charge appears on personal account or personal recurring charge appears on business account.

Action items should be specific:

- """Add APR and minimum payment for Capital One."""
- """Confirm whether Netflix is still active."""
- """Review 4 suspected recurring charges."""
- """Capital One is over 80% utilization."""

## Pages

### `/debt`

Sections:

- Summary cards:
  - total debt
  - total minimum payments
  - highest APR
  - accounts missing details
- Debt list/table:
  - name
  - usage type
  - balance
  - APR
  - minimum payment
  - due date
  - utilization
  - pressure label
- Create/edit debt form.
- Blunt payoff priority panel.

The page should be utilitarian and dense, not decorative.

### `/recurring`

Sections:

- Summary cards:
  - confirmed monthly recurring total
  - suspected recurring count
  - price increase count
  - business/personal mismatch count
- Lists/tables:
  - suspected items
  - confirmed items
  - ignored/cancelled items behind a filter
- Actions:
  - confirm
  - ignore
  - mark cancelled
  - edit usage type/category/cadence
- Detection trigger:
  - """Scan accepted transactions"""

## APIs

Debt:

- `GET /api/debt-accounts`
- `POST /api/debt-accounts`
- `PATCH /api/debt-accounts/:id`
- `DELETE /api/debt-accounts/:id`

Recurring:

- `GET /api/recurring-items`
- `PATCH /api/recurring-items/:id`
- `POST /api/recurring-items/scan`

Action items:

- Existing action item service should be extended to create/update debt and recurring actions.
- This slice does not need a full action item management API, but it may add minimal `PATCH /api/action-items/:id` if the UI needs done/snooze/dismiss.

## Services

### Debt Service

Files should separate pure math from persistence:

- `src/lib/debt/calculations.ts`
- `src/lib/debt/service.ts`
- `src/lib/debt/actions.ts`

Responsibilities:

- Calculate utilization, monthly interest, pressure labels, and payoff priority.
- Read/create/update/delete owner-scoped debt accounts.
- Create action items for missing debt details and urgent pressure.

### Recurring Service

Files should separate detection from persistence:

- `src/lib/recurring/detection.ts`
- `src/lib/recurring/service.ts`
- `src/lib/recurring/actions.ts`

Responsibilities:

- Group accepted transactions by merchant key.
- Detect cadence and typical amount.
- Detect price increases.
- Upsert suspected recurring items and transaction links.
- Create action items for suspected recurring items and price increases.

## Error Handling

- Invalid debt numeric fields return 400 with validation details.
- Debt account updates must verify `owner_user_id`.
- Recurring updates must verify `owner_user_id`.
- Recurring scan should return a summary even if no candidates are found.
- Missing database should return mock data or graceful sample-mode behavior, consistent with the existing app.

## Testing Strategy

Unit tests:

- Debt utilization.
- Debt monthly interest estimate.
- Debt pressure classification.
- Payoff priority selection.
- Recurring merchant grouping.
- Cadence detection.
- Amount tolerance.
- Price increase detection.
- Action item creation helpers.

Integration-ish tests using service helpers:

- Debt account with missing APR creates missing-info action.
- Recurring scan produces suspected items from monthly transactions.
- Ignored recurring items are not re-created as new suspected items.

Commands:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Known existing caveat:

- At the time of this spec, lint has a pre-existing `PlaidLinkManager` hook issue unrelated to Debt + Recurring Core. The implementation plan should either fix that first or document it as pre-existing before final merge.

## Follow-On Slices

This slice intentionally enables the later missing features:

- Reports + Reminders can use debt accounts, recurring items, and action items.
- AI Brief + Chat can cite debt pressure and recurring obligations.
- PDF Import can extract debt fields and recurring hints into these models.
