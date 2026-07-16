export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(
  obj: Record<string, unknown>,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = obj[name];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

export function readRecord(
  obj: Record<string, unknown>,
  names: readonly string[],
): Record<string, unknown> | undefined {
  for (const name of names) {
    const value = obj[name];
    if (isRecord(value)) return value;
  }
  return undefined;
}

export function summarizeUnknown(value: unknown, maxLength = 500): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return undefined;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
