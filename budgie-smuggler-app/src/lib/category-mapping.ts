const CATEGORY_RULES: { name: string; tokens: string[] }[] = [
  {
    name: "Groceries",
    tokens: ["GROCERY", "GROCER", "SUPERMARKET", "WHOLEFOODS", "TRADERJOE", "KROGER", "SAFEWAY"],
  },
  {
    name: "Dining",
    tokens: ["RESTAURANT", "FAST_FOOD", "CAFE", "COFFEE", "DOORDASH", "UBEREATS", "DINING"],
  },
  {
    name: "Transport",
    tokens: ["TRANSPORT", "GAS", "FUEL", "PARKING", "RIDESHARE", "UBER", "LYFT", "TRANSIT", "TOLL"],
  },
  {
    name: "Utilities",
    tokens: ["UTILITY", "ELECTRIC", "WATER", "GAS_BILL", "INTERNET", "PHONE", "CABLE"],
  },
  {
    name: "Housing",
    tokens: ["RENT", "MORTGAGE", "HOME", "HOUSING", "PROPERTY"],
  },
];

function normalize(input: string) {
  return input.replace(/\s+/g, "_").toUpperCase();
}

export function inferCategoryNameFromPlaid({
  plaidDetailed,
  merchantName,
  description,
}: {
  plaidDetailed?: string | null;
  merchantName?: string | null;
  description?: string | null;
}) {
  const haystack = [plaidDetailed, merchantName, description]
    .filter(Boolean)
    .map((value) => normalize(String(value)))
    .join("|");

  for (const rule of CATEGORY_RULES) {
    if (rule.tokens.some((token) => haystack.includes(token))) {
      return rule.name;
    }
  }

  return null;
}
