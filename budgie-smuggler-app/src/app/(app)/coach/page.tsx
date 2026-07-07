import { MoneyBriefConsole } from "@/components/ai/money-brief-console";

export default function CoachPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Coach</h1>
        <p className="text-sm text-neutral-600">Grok-backed answers when configured. Rule-based fallback when it is not.</p>
      </header>

      <MoneyBriefConsole />
    </div>
  );
}
