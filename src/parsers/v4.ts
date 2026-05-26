// UUID v4 generator using crypto API
export function v4(): string {
  return crypto.randomUUID();
}
