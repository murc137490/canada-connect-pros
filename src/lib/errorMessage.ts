/** Turn thrown values / Supabase errors into a safe string for UI toasts. */
export function errorMessage(value: unknown): string {
  if (value == null) return "Something went wrong.";
  if (typeof value === "string") return value;
  if (value instanceof Error) {
    const m = value.message || "";
    if (m === "[object Object]" || /^\[object Object\]$/i.test(m.trim())) {
      return "Something went wrong.";
    }
    return m || "Something went wrong.";
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("message" in obj) {
      const nested = errorMessage(obj.message);
      if (nested && nested !== "[object Object]") return nested;
    }
    const nestedErr = obj.error;
    if (nestedErr != null) {
      const nested = errorMessage(nestedErr);
      if (nested && nested !== "[object Object]") return nested;
    }
    if ("details" in obj) {
      const nested = errorMessage(obj.details);
      if (nested && nested !== "[object Object]") return nested;
    }
    try {
      return JSON.stringify(obj);
    } catch {
      return String(value);
    }
  }

  return String(value);
}
