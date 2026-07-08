# Remaining Finance Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining finance-control gaps after Debt Recurring Core: reports, delivered reminders, AI brief/chat, PDF import, subscription cut list, and debt-field UI completeness.

**Architecture:** Continue on the existing `debt-recurring-core` branch. Add focused service modules for reports, AI money context, and PDF extraction. Keep xAI calls behind the existing Grok wrapper pattern with deterministic fallback when `XAI_API_KEY` is missing. Surface features as practical app pages and API routes, not marketing pages.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, Supabase Postgres/RLS, Vitest, Zod, xAI Chat Completions, optional `pdf-parse` for server-side PDF text extraction, Resend alert email.

---

## Scope Decisions

- PDF import supports text-based statement PDFs. Scanned image PDFs can fail with a blunt "text extraction failed" message.
- PDF parsing converts extracted text into the existing CSV import staging path when recognizable date/description/amount lines are found.
- AI brief/chat uses Grok when configured and fallback rules when not configured.
- AI context includes balances, debt terms, recurring charges, cash flow, open action counts, and top recent transactions, with redaction before external calls.
- Reports are app-native summaries: household reality, personal vs business, debt pressure, subscription cut list.
- Delivered reminders use the existing alert cron and email infrastructure, generating daily action reminder events for open high/urgent action items.
- No bank auto-pay, tax filing, accounting export, OCR, or Plaid production approval work in this slice.

## File Structure

- Modify `budgie-smuggler-app/package.json`
  - Add `pdf-parse`.
- Modify `budgie-smuggler-app/package-lock.json`
  - Lock the PDF parser dependency.
- Create `budgie-smuggler-app/src/lib/imports/pdf.ts`
  - Extract text from PDFs and parse simple statement lines.
- Create `budgie-smuggler-app/src/lib/imports/pdf.test.ts`
  - Cover text-line parsing without requiring binary PDF fixtures.
- Modify `budgie-smuggler-app/src/lib/imports/service.ts`
  - Add `importPdfForAccount` that stages parsed PDF rows through the same database logic as CSV.
- Modify `budgie-smuggler-app/src/app/api/imports/route.ts`
  - Accept `.pdf` as well as `.csv`.
- Modify `budgie-smuggler-app/src/components/import/import-upload-form.tsx`
  - Accept CSV/PDF and update copy.
- Create `budgie-smuggler-app/src/lib/reports/service.ts`
  - Build household, personal/business, debt, and subscription-cut report data.
- Create `budgie-smuggler-app/src/app/(app)/reports/page.tsx`
  - Render reports.
- Modify `budgie-smuggler-app/src/lib/constants.ts`
  - Add `/reports`.
- Create `budgie-smuggler-app/src/lib/ai/money-context.ts`
  - Build redacted money context for Grok brief/chat.
- Modify `budgie-smuggler-app/src/lib/ai/schemas.ts`
  - Add schemas for brief and chat output.
- Modify `budgie-smuggler-app/src/lib/ai/grok.ts`
  - Add `generateMoneyBrief` and `answerMoneyQuestion`.
- Create `budgie-smuggler-app/src/app/api/ai/money-brief/route.ts`
  - Return Grok/fallback money brief.
- Create `budgie-smuggler-app/src/app/api/ai/money-chat/route.ts`
  - Return Grok/fallback answer to a user question.
- Create `budgie-smuggler-app/src/components/ai/money-brief-console.tsx`
  - Client UI for brief generation and chat.
- Create `budgie-smuggler-app/src/app/(app)/coach/page.tsx`
  - AI coach page.
- Modify `budgie-smuggler-app/src/lib/alert-jobs.ts`
  - Add daily reminder events for open high/urgent action items.
- Modify `budgie-smuggler-app/src/components/debt/debt-console.tsx`
  - Add remaining debt fields: due day, statement close day, promo APR, promo expiration, last payment amount/date, last statement balance.
- Modify `budgie-smuggler-app/README.md`
  - Document PDF import, reports, AI coach, and reminder delivery.

---

### Task 1: PDF Import

- [ ] Add `pdf-parse`.
- [ ] Create `parsePdfStatementText(text)` with tests for lines like `06/14/2026 NETFLIX.COM 19.99`.
- [ ] Create `extractPdfText(buffer)` with `pdf-parse`.
- [ ] Add `importPdfForAccount` and route handling for `.pdf`.
- [ ] Update import form accept/copy.
- [ ] Run `npm test -- src/lib/imports` and commit.

### Task 2: Reports

- [ ] Create `getReportsData(userId)` with household cash flow, personal/business spending, debt pressure, and cut-list rows.
- [ ] Add `/reports` page and nav item.
- [ ] Run typecheck and commit.

### Task 3: AI Brief And Chat

- [ ] Create money context builder.
- [ ] Add schemas and Grok/fallback functions for brief and chat.
- [ ] Add `/coach` page and API routes.
- [ ] Run typecheck and commit.

### Task 4: Delivered Reminder Hooks

- [ ] Extend alert cron job to create/send daily high-priority action reminders.
- [ ] Deduplicate reminder events by date and action IDs.
- [ ] Run tests/typecheck and commit.

### Task 5: Debt Field UI Completeness

- [ ] Add the remaining debt account fields to `DebtConsole`.
- [ ] Run typecheck/lint and commit.

### Task 6: Full Verification

- [ ] Run `npm test`.
- [ ] Run `rm -rf .next && npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Commit README updates.

## Self-Review

- Spec coverage: Remaining requested gaps are covered: PDF upload, AI "brains" with Grok, blunt reports, subscription cut list, personal/business reporting, delivered reminder hooks, and debt field completeness.
- Placeholder scan: The plan uses concrete files, functions, pages, commands, and behavior. It excludes OCR and external payment execution explicitly.
- Type consistency: Route/page names match the planned files: `/reports`, `/coach`, `/api/ai/money-brief`, `/api/ai/money-chat`, `getReportsData`, `buildMoneyContext`, `generateMoneyBrief`, and `answerMoneyQuestion`.
