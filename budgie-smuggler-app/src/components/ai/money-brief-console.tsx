"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Brief = {
  headline: string;
  bluntSummary: string;
  topRisks: string[];
  nextActions: string[];
  subscriptionsToReview: string[];
  confidence: number;
};

type ChatAnswer = {
  answer: string;
  evidence: string[];
  nextActions: string[];
  confidence: number;
};

export function MoneyBriefConsole() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [question, setQuestion] = useState("What should I do first today?");
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generateBrief() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/ai/money-brief", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Brief failed.");
      }

      setBrief(payload.brief);
      setSource(payload.source);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Brief failed.");
    } finally {
      setBusy(false);
    }
  }

  async function askQuestion() {
    if (!question.trim()) {
      setMessage("Ask a direct money question.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/ai/money-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ? JSON.stringify(payload.error) : "Chat failed.");
      }

      setAnswer(payload.answer);
      setSource(payload.source);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chat failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Daily brief</h2>
            <p className="text-sm text-neutral-600">Blunt summary from current app data.</p>
          </div>
          <Button type="button" disabled={busy} onClick={() => void generateBrief()}>
            {busy ? "Thinking..." : "Generate brief"}
          </Button>
        </div>

        {brief ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
              <h3 className="font-semibold">{brief.headline}</h3>
              <p className="mt-1 text-sm">{brief.bluntSummary}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ListBlock title="Top risks" items={brief.topRisks} />
              <ListBlock title="Next actions" items={brief.nextActions} />
              <ListBlock title="Subscriptions" items={brief.subscriptionsToReview} />
            </div>
            <p className="text-xs text-neutral-500">Source: {source}. Confidence: {Math.round(brief.confidence * 100)}%.</p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700">Generate a brief after imports, debt, and recurring charges are updated.</p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="text-lg font-semibold">Ask the money operator</h2>
        <div className="mt-4 grid gap-3">
          <Input value={question} onChange={(event) => setQuestion(event.target.value)} />
          <Button type="button" disabled={busy} onClick={() => void askQuestion()}>
            Ask
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm font-semibold text-red-700">{message}</p> : null}
        {answer ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="font-semibold">{answer.answer}</p>
            <ListBlock title="Evidence" items={answer.evidence} />
            <ListBlock title="Next actions" items={answer.nextActions} />
            <p className="text-xs text-neutral-500">Source: {source}. Confidence: {Math.round(answer.confidence * 100)}%.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-neutral-50 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-neutral-600">Nothing obvious yet.</p>
      )}
    </div>
  );
}
