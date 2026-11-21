/**
 * Unique ID generator for renderer entities (Node 22 / Chromium 134 always provide Web Crypto).
 */
export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

