# AI-Assisted Money Control Design

Date: 2026-07-07
Project: Budgie Smuggler

## Purpose

Budgie Smuggler should shift from a Plaid-dependent budgeting app into a blunt, AI-assisted money control system. The app must help a user who struggles to consistently track finances by showing exactly what needs attention, importing real transaction data without waiting for Plaid, separating personal and business finances, tracking debt pressure, and using Grok to explain and prioritize the situation.

The core product rule is:

> The ledger is authoritative. AI is the command center.

The database remains the source of truth for accounts, transactions, debts, recurring payments, and action items. Grok can parse, classify, summarize, and recommend actions, but it must not silently create authoritative financial facts without review when confidence is low or the impact is material.

## Goals

- Make `Today` the default screen and action inbox.
- Support manual statement imports before Plaid is fully available.
- Support CSV first, then PDF parsing and AI-assisted extraction.
- Track personal, business, mixed, and unknown financial activity.
- Identify subscriptions, recurring bills, transfers, debt payments, interest, fees, refunds, and business expenses.
- Track credit card and debt details such as APR, minimum payment, due date, credit limit, statement close date, and balance.
- Use Grok for structured classification, summaries, and a focused financial chat.
- Provide blunt, persistent reminders tied to concrete actions.
- Preserve privacy through selective redaction and audit logs of AI usage.

## Non-Goals

- Do not build a full accounting system in the first version.
- Do not add invoicing, tax prep, double-entry bookkeeping, or a chart of accounts.
- Do not make AI the source of truth for balances, totals, or imported transactions.
- Do not require Plaid before the app is useful.
- Do not require perfect categorization before showing useful financial reality.

## Product Shape

The app should feel like an operational dashboard, not a passive budget chart. The default screen is `Today`, with two primary sections.

### Action Inbox

The action inbox shows a short list of concrete tasks. It should avoid vague prompts like "review finances" and instead say exactly what to do.

Examples:

- Import the missing Capital One statement.
- Review 14 uncategorized transactions.
- Confirm 3 possible subscriptions.
- Add APR and minimum payment for 2 cards.
- Classify 5 charges as personal or business.
- Check the card whose balance increased by $421.

The inbox should cap the default `Do Now` view to 3 to 5 items, with overdue and lower-priority items available below.

### Blunt AI Brief

Grok produces a concise brief from app data. The tone is direct, practical, and not cruel.

Examples:

- You are cash-flow negative this month.
- Your business card balance is increasing.
- Subscriptions are at least $187/month, with 4 unconfirmed.
- This report is incomplete because Chase data is missing.
- Do these 3 things today.

The brief must show uncertainty when data is missing or confidence is low.

## Navigation

The main app navigation should become:

- `Today`
- `Chat`
- `Import`
- `Review`
- `Debt`
- `Recurring`
- `Reports`
- `Settings`

`Chat` is a financial operator over app data, not a generic chatbot. It should answer questions using ledger data, action items, debt records, recurring items, and import status.

## Data Model Direction

The existing transaction, budget, Plaid, alert, and insight models should be evolved rather than replaced.

### Financial Account

Represents any account that can contain transactions or balances.

Key fields:

- id
- owner user id
- name
- institution name
- account type: checking, savings, credit card, loan, cash, other
- usage type: personal, business, mixed, unknown
- source type: manual, import, plaid
- last imported at
- current balance
- available balance
- status

Existing `BankAccount` can either be generalized into this concept or remain as a Plaid-linked account while a broader account model is introduced. The implementation plan should choose the lowest-risk migration path after inspecting current app usage.

### Import Batch

Represents one uploaded file or import attempt.

Key fields:

- id
- owner user id
- account id
- file name
- file type: csv, pdf
- date range detected
- parser status: uploaded, parsed, needs review, accepted, failed
- raw file storage path
- extracted text storage path, if applicable
- redaction summary
- created at

### Imported Transaction

Represents parsed rows before they are accepted into the ledger.

Key fields:

- id
- import batch id
- owner user id
- account id
- raw date
- parsed date
- raw description
- normalized description
- amount
- direction
- detected category
- detected usage type: personal, business, mixed, unknown
- detected cash-flow role: spending, income, transfer, debt payment, interest, fee, refund, other
- duplicate candidate id
- confidence
- review status
- source row metadata

### Ledger Transaction

The existing `transactions` table remains the authoritative ledger, but it should gain enough metadata to support non-Plaid imports and business/personal classification.

Likely additions:

- source type: plaid, csv, pdf, manual
- source import batch id
- usage type: personal, business, mixed, unknown
- cash-flow role
- notes
- review status
- confidence
- user-confirmed flags

### Debt Account

Tracks credit cards, loans, and other debt obligations.

Key fields:

- id
- owner user id
- financial account id
- balance
- APR
- minimum payment
- due date
- statement close date
- credit limit
- utilization
- promo APR
- promo APR expiration
- personal/business/mixed usage type
- spending status: active, frozen, unknown

Debt data may be entered manually, extracted from statements, or later synced from a provider. Important debt details require review before they are used in high-confidence recommendations.

### Recurring Item

Tracks subscriptions, fixed bills, recurring vendors, and suspected recurring charges.

Key fields:

- id
- owner user id
- merchant name
- normalized merchant key
- amount or amount range
- cadence: weekly, monthly, yearly, irregular
- next expected date
- linked transactions
- category
- usage type
- status: suspected, confirmed, ignored, cancelled
- price increase detected

### Action Item

Persistent task created by import, review, debt, recurring, reminders, or AI analysis.

Key fields:

- id
- owner user id
- type
- title
- body
- priority
- due date
- status: open, snoozed, done, dismissed
- related entity type
- related entity id
- source: system, rule, ai
- created at

### AI Run and AI Finding

Stores AI usage for auditability and repeatability.

`AiRun` fields:

- id
- owner user id
- provider: xai
- model
- purpose: classification, brief, chat, extraction
- redaction level
- prompt version
- input summary
- output status
- created at

`AiFinding` fields:

- id
- ai run id
- owner user id
- finding type
- structured output
- confidence
- related entity type
- related entity id
- review status

## AI Provider

Use xAI/Grok first. xAI's API is OpenAI-compatible and supports structured outputs and file/document workflows. The application should isolate provider access behind an internal AI service so a future provider change does not rewrite product logic.

Required capabilities:

- structured JSON outputs
- transaction classification
- recurring payment detection support
- statement extraction support for PDFs when local parsing is insufficient
- chat/brief generation over app facts

The app should not send secrets such as Plaid tokens, internal user ids, full account numbers, bank login data, or unnecessary raw documents to Grok.

## Privacy and Redaction

Use selective redaction rather than full redaction.

Allowed to send to Grok when relevant:

- transaction dates
- amounts
- merchant or description
- account nickname and account type
- personal/business/mixed account usage
- category guesses
- balances, APRs, minimum payments, and due dates when needed for debt analysis

Do not send by default:

- full account numbers
- addresses
- legal names when avoidable
- raw PDF pages unless needed for extraction
- Plaid access tokens
- Supabase ids or internal user ids
- authentication data

The app should keep an audit trail of what kind of data was sent, why it was sent, model used, and whether the output created reviewed or unreviewed findings.

## Classification Pipeline

Classification runs in layers.

### 1. Deterministic Parsing

CSV and local PDF text extraction happen before AI. The parser normalizes dates, amounts, descriptions, account source, and direction.

### 2. Rules

Confirmed user decisions become reusable rules:

- merchant match
- amount pattern
- account-specific default
- personal/business override
- transfer/payment detection
- category mapping

### 3. Grok Structured Analysis

Grok receives redacted rows and returns structured JSON:

- suggested category
- usage type: personal, business, mixed, unknown
- cash-flow role
- subscription likelihood
- debt-related flags
- duplicate suspicion
- confidence
- reason
- user-facing question, if needed

### 4. Human Review

Low-confidence, business/personal ambiguous, debt-impacting, duplicate-related, or high-dollar items go to review before they affect high-confidence reporting.

## Workflows

### Daily Flow

The user opens `Today` and sees:

- 3 to 5 `Do Now` items
- blunt financial reality summary
- missing data warnings
- upcoming debt/payment pressure
- focused Ask Grok prompts

Suggested prompts:

- What needs my attention today?
- Where did money leak this week?
- What subscriptions can I cut?
- Which card is hurting us most?
- What changed since last month?

### Import Flow

1. Choose or create account.
2. Upload CSV or PDF.
3. Parse locally where possible.
4. Use Grok only where parsing or classification is uncertain.
5. Show import summary:
   - transactions found
   - duplicates skipped
   - likely transfers/payments
   - needs review
   - suspected subscriptions
   - debt details found
6. User confirms.
7. Accepted transactions enter ledger.
8. Action items are created for unresolved issues.

### Review Flow

Each review item asks one simple question:

- Is this business or personal?
- Is this a subscription?
- Is this a credit card payment?
- What category is this?
- Should the app remember this rule?

Bulk accept is allowed for high-confidence items, but uncertainty remains visible.

### Debt Flow

Each card or debt account shows:

- balance
- APR
- minimum payment
- due date
- limit
- utilization
- payment status
- payoff warning

Blunt messages:

- This card is over 80% utilization.
- You paid $300, but the balance still rose.
- Minimum payment only is not a plan.
- This is the next card to attack.

### Recurring Flow

The app detects likely recurring charges and asks for confirmation.

It should identify:

- subscriptions
- fixed bills
- annual renewals
- weekly or monthly services
- amount increases
- duplicate services
- business subscriptions on personal cards
- personal subscriptions on business cards

### Reminder Flow

Reminders are tied to action items and debt deadlines.

Initial channels:

- in-app
- email

Future channels:

- push notification
- SMS

Reminder examples:

- Review 8 uncategorized transactions today.
- Your Amex payment is due in 3 days.
- You are missing June data from Chase.
- A suspected subscription increased from $19 to $29.
- Business card debt increased this week.

## Reporting

Reports should be available in personal, business, and combined views.

Core reports:

- cash flow: income vs outflow
- spending by category
- business vs personal spending
- debt totals
- minimum payments due
- utilization by card
- recurring monthly obligations
- subscriptions by status
- missing data warnings
- month-over-month changes

Reports must distinguish between:

- spending
- income
- transfers
- debt payments
- interest
- fees
- refunds

This prevents credit card payments and internal transfers from being double-counted as spending.

## Milestones

### Milestone 1: Manual Data Foundation

- Add accounts that can be personal, business, mixed, or unknown.
- Add import batches.
- Support CSV upload first.
- Normalize imported transactions into a review queue.
- Accept reviewed transactions into the ledger.
- Add duplicate detection.
- Add source labels so Plaid, manual, CSV, and PDF data can coexist.

### Milestone 2: Today Inbox

- Add persistent action items.
- Make `Today` the default screen.
- Surface missing imports, uncategorized transactions, unresolved business/personal classifications, and debt info gaps.
- Add blunt status cards.

### Milestone 3: Grok Classification

- Add xAI/Grok provider behind an internal AI service.
- Redact transaction/account data before sending.
- Use structured outputs.
- Let Grok suggest category, cash-flow role, business/personal, subscription likelihood, duplicate suspicion, and user questions.
- Keep AI suggestions reviewable.
- Do not build the full chat or AI brief experience yet; those belong to Milestone 6.

### Milestone 4: Debt and Credit Cards

- Add debt account fields.
- Detect interest, fees, payments, and balance transfers.
- Add payoff pressure and minimum-payment warnings.

### Milestone 5: Recurring Payments

- Detect subscriptions and fixed bills from transaction patterns.
- Confirm, cancel, or ignore recurring items.
- Track monthly recurring total.
- Flag increases and duplicate services.

### Milestone 6: AI Brief and Chat

- Add `Chat` as a financial operator over app data.
- Add daily and weekly Grok briefs.
- Require references to internal app facts.
- Make uncertainty explicit.

### Milestone 7: Reminders

- Add email and in-app reminders for action items.
- Add due date warnings.
- Add missing import warnings.
- Add recurring review and debt worsening reminders.

## First Implementation Scope

The first implementation plan should cover Milestones 1 through 3 only.

Milestones 4 through 7 are part of the product direction and should influence the data model, but they should not be fully implemented in the first pass.

The first pass supports CSV import. PDF support is designed for, but not required for, the first implementation plan.

The first useful version is successful when:

- The user can create/import accounts without Plaid.
- The user can upload at least one CSV statement.
- Imported rows appear in a review queue.
- Reviewed rows become ledger transactions.
- The `Today` screen shows concrete open tasks.
- Grok can classify redacted imported transactions into structured suggestions.
- The app clearly distinguishes confirmed ledger facts from AI suggestions.

## Testing Strategy

Milestones 1 through 3 should include:

- parser unit tests for CSV formats
- amount and direction normalization tests
- duplicate detection tests
- business/personal classification tests
- action item creation tests
- AI redaction tests
- structured output schema validation tests
- integration tests for import to review to ledger acceptance

AI calls should be wrapped so tests can use deterministic fixtures instead of live Grok requests.

## Open Implementation Decisions

These should be resolved during implementation planning:

- Whether to generalize the existing `BankAccount` model or introduce a separate `FinancialAccount`.
- Which CSV formats to support first.
- How uploaded files are stored in local development and production.
- Whether PDF support begins with text-based PDFs only or includes scanned statement workflows later.
- Whether the first `Today` page replaces the current dashboard route or becomes a new route that the app redirects to.
- Whether reminders in the first slice are stored only as action items or also delivered by email immediately.
