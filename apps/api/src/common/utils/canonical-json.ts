/**
 * Deterministic JSON serialization.
 *
 * The passport hash-chain must produce the SAME hash for the SAME logical
 * payload regardless of key insertion order. We therefore recursively sort
 * object keys before stringifying. Arrays preserve order (order is meaningful).
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(source[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
