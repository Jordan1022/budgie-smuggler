import type { BudgetProgress } from "@/types/domain";

export const MOCK_BUDGET_PROGRESS: BudgetProgress[] = [
  {
    budgetId: "bgt-groceries",
    categoryId: "cat-groceries",
    categoryName: "Groceries",
    limit: 900,
    spent: 642.12,
    remaining: 257.88,
    percentUsed: 71.3,
  },
  {
    budgetId: "bgt-transport",
    categoryId: "cat-transport",
    categoryName: "Transport",
    limit: 450,
    spent: 281.88,
    remaining: 168.12,
    percentUsed: 62.6,
  },
  {
    budgetId: "bgt-dining",
    categoryId: "cat-dining",
    categoryName: "Dining",
    limit: 300,
    spent: 334.91,
    remaining: -34.91,
    percentUsed: 111.6,
  },
];

export const MOCK_TRANSACTIONS = [
  {
    id: "txn-1",
    postedDate: "2026-03-02",
    merchantName: "Trader Joe's",
    description: "Groceries",
    amount: 96.42,
    direction: "debit",
    categoryId: "cat-groceries",
    userOverrideCategory: false,
    rawCategory: ["FOOD", "GROCERIES"],
    categoryName: "Groceries",
  },
  {
    id: "txn-2",
    postedDate: "2026-03-03",
    merchantName: "Shell",
    description: "Fuel",
    amount: 54.87,
    direction: "debit",
    categoryId: "cat-transport",
    userOverrideCategory: false,
    rawCategory: ["TRANSPORTATION", "FUEL"],
    categoryName: "Transport",
  },
  {
    id: "txn-3",
    postedDate: "2026-03-04",
    merchantName: "Chipotle",
    description: "Dinner",
    amount: 22.65,
    direction: "debit",
    categoryId: "cat-dining",
    userOverrideCategory: true,
    rawCategory: ["FOOD", "RESTAURANT"],
    categoryName: "Dining",
  },
];

export const MOCK_INSIGHTS = [
  {
    id: "ins-1",
    summary: "Dining is up 18% from last month.",
    details: "Most increase came from weekend spending.",
  },
  {
    id: "ins-2",
    summary: "Groceries are tracking under budget.",
    details: "You have roughly $258 remaining this month.",
  },
  {
    id: "ins-3",
    summary: "Potential recurring charge detected.",
    details: "A $14.99 subscription appears monthly on the 5th.",
  },
];
