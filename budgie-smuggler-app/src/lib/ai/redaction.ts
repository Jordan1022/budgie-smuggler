export type RedactionSummary = {
  removedLongDigitRuns: number;
  removedUuidLikeValues: number;
};

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_DIGIT_PATTERN = /\b\d{6,}\b/g;

function redactValue(value: unknown, summary: RedactionSummary): unknown {
  if (typeof value === "string") {
    let output = value.replace(UUID_PATTERN, () => {
      summary.removedUuidLikeValues += 1;
      return "[redacted-id]";
    });

    output = output.replace(LONG_DIGIT_PATTERN, () => {
      summary.removedLongDigitRuns += 1;
      return "[redacted-number]";
    });

    return output;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, summary));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.toLowerCase().includes("userid"))
        .map(([key, nested]) => [key, redactValue(nested, summary)]),
    );
  }

  return value;
}

export function redactForAi<T>(input: T): { redacted: T; summary: RedactionSummary } {
  const summary = {
    removedLongDigitRuns: 0,
    removedUuidLikeValues: 0,
  };

  return {
    redacted: redactValue(input, summary) as T,
    summary,
  };
}
