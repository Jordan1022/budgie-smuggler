"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BudgetItem = {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  limit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
};

type CategoryItem = {
  id: string;
  name: string;
  color?: string | null;
};

type BudgetEditorProps = {
  initialBudgets: BudgetItem[];
  initialCategories: CategoryItem[];
  source: "mock" | "database";
};

type EditableRow = {
  categoryId: string;
  categoryName: string;
  color?: string | null;
  amountLimit: number;
  spent: number;
};

export function BudgetEditor({ initialBudgets, initialCategories, source }: BudgetEditorProps) {
  const initialRows = useMemo<EditableRow[]>(() => {
    const budgetByCategory = new Map(initialBudgets.map((item) => [item.categoryId, item]));
    return initialCategories.map((category) => {
      const budget = budgetByCategory.get(category.id);
      return {
        categoryId: category.id,
        categoryName: category.name,
        color: category.color,
        amountLimit: budget?.limit ?? 0,
        spent: budget?.spent ?? 0,
      };
    });
  }, [initialBudgets, initialCategories]);

  const [rows, setRows] = useState(initialRows);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6b7280");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateRow(categoryId: string, amountLimit: number) {
    setRows((current) => current.map((row) => (row.categoryId === categoryId ? { ...row, amountLimit } : row)));
  }

  async function saveBudgets() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/budgets", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: rows.map((row) => ({
            categoryId: row.categoryId,
            amountLimit: Number.isFinite(row.amountLimit) ? row.amountLimit : 0,
            rolloverEnabled: false,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Budget save failed.");
      }

      setMessage(source === "mock" ? "Saved in mock mode (no database configured)." : "Budgets saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save budgets.");
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          color: newCategoryColor,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create category.");
      }

      const payload = (await response.json()) as { category?: { id: string; name: string; color?: string | null } };
      const created = payload.category;

      setRows((current) => [
        ...current,
        {
          categoryId: created?.id ?? `mock-${Date.now()}`,
          categoryName: created?.name ?? name,
          color: created?.color ?? newCategoryColor,
          amountLimit: 0,
          spent: 0,
        },
      ]);

      setNewCategoryName("");
      setMessage(source === "mock" ? "Added in mock mode only." : "Category added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Category budgets</h2>

        <div className="space-y-3">
          {rows.map((row) => {
            const percent = row.amountLimit > 0 ? Math.round((row.spent / row.amountLimit) * 100) : 0;
            return (
              <div key={row.categoryId} className="rounded-xl border border-[var(--line)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color ?? "#9ca3af" }} />
                    <p className="text-sm font-semibold">{row.categoryName}</p>
                  </div>
                  <p className="text-xs text-neutral-500">Spent: {formatCurrency(row.spent)}</p>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs text-neutral-500">Monthly limit</span>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={Number.isFinite(row.amountLimit) ? row.amountLimit : 0}
                    onChange={(event) => updateRow(row.categoryId, Number(event.target.value || 0))}
                  />
                </label>

                <p className="mt-2 text-xs text-neutral-500">Current usage: {Number.isFinite(percent) ? percent : 0}%</p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={saveBudgets} disabled={saving}>
            {saving ? "Saving..." : "Save budget limits"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Add category</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <Input placeholder="Category name" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
          <Input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} />
          <Button onClick={addCategory} disabled={saving}>
            Add
          </Button>
        </div>
      </section>

      {message ? <p className="text-sm text-neutral-700">{message}</p> : null}
    </div>
  );
}
