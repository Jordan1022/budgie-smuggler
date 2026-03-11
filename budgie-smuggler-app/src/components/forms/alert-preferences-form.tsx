"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AlertPreferences = {
  enabled: boolean;
  thresholdPercents: number[];
  weeklyDigestDay: number;
  unusualSpendMultiplier: number;
  channels: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  notifyOn: {
    threshold: boolean;
    overspend: boolean;
    unusualSpend: boolean;
    weeklyDigest: boolean;
  };
};

export function AlertPreferencesForm({
  initialPreferences,
  source,
}: {
  initialPreferences: AlertPreferences;
  source: "mock" | "database";
}) {
  const [state, setState] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const thresholdText = useMemo(() => state.thresholdPercents.join(","), [state.thresholdPercents]);

  async function save() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/alerts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(state),
      });

      if (!response.ok) {
        throw new Error("Failed to save alert preferences.");
      }

      setMessage(source === "mock" ? "Saved in mock mode." : "Alert preferences saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <h2 className="mb-3 text-lg font-semibold">Alert preferences</h2>

      <div className="space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(event) => setState((current) => ({ ...current, enabled: event.target.checked }))}
          />
          <span>Enable all notifications</span>
        </label>

        <div className="grid gap-2 md:grid-cols-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.channels.email}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  channels: { ...current.channels, email: event.target.checked },
                }))
              }
            />
            <span>Email</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.channels.inApp}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  channels: { ...current.channels, inApp: event.target.checked },
                }))
              }
            />
            <span>In-app feed</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.channels.push}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  channels: { ...current.channels, push: event.target.checked },
                }))
              }
            />
            <span>Push (queued for future)</span>
          </label>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.notifyOn.threshold}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  notifyOn: { ...current.notifyOn, threshold: event.target.checked },
                }))
              }
            />
            <span>Threshold alerts</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.notifyOn.overspend}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  notifyOn: { ...current.notifyOn, overspend: event.target.checked },
                }))
              }
            />
            <span>Overspend alerts</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.notifyOn.unusualSpend}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  notifyOn: { ...current.notifyOn, unusualSpend: event.target.checked },
                }))
              }
            />
            <span>Unusual spend alerts</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.notifyOn.weeklyDigest}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  notifyOn: { ...current.notifyOn, weeklyDigest: event.target.checked },
                }))
              }
            />
            <span>Weekly digest</span>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-neutral-500">Threshold percentages (comma-separated)</span>
          <Input
            value={thresholdText}
            onChange={(event) => {
              const values = event.target.value
                .split(",")
                .map((part) => Number(part.trim()))
                .filter((value) => Number.isFinite(value) && value > 0 && value <= 300);

              setState((current) => ({ ...current, thresholdPercents: values.length ? values : [50, 80, 100] }));
            }}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Weekly digest day (0=Sun, 6=Sat)</span>
            <Input
              type="number"
              min={0}
              max={6}
              value={state.weeklyDigestDay}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  weeklyDigestDay: Math.max(0, Math.min(6, Number(event.target.value || 1))),
                }))
              }
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Unusual spend multiplier</span>
            <Input
              type="number"
              min={1.1}
              step={0.1}
              value={state.unusualSpendMultiplier}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  unusualSpendMultiplier: Math.max(1.1, Number(event.target.value || 1.3)),
                }))
              }
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
        {message ? <span className="text-sm text-neutral-700">{message}</span> : null}
      </div>
    </section>
  );
}
