const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1[REDACTED]"],
  [/\b([A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY)[A-Za-z0-9_]*\s*[:=]\s*)(["']?)[^"'\s]+/gi, "$1$2[REDACTED]"],
  [/\b(sk-[A-Za-z0-9_-]{16,})\b/g, "[REDACTED_OPENAI_KEY]"],
];

export function redactText(text: string): string {
  return SECRET_PATTERNS.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, text);
}

export function redactValue<T>(value: T): T {
  if (typeof value === "string") return redactText(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactValue(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactValue(nested);
    }
    return out as T;
  }
  return value;
}
