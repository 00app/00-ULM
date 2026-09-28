/**
 * In-memory store for the last flushed user context markdown, keyed per requester
 * (see `resolveMemoryScopeKey` in `lib/requestAuth.ts`) so one warm serverless instance
 * serving concurrent requests from different people can't hand one person's profile
 * context into another person's Gemini prompt.
 * Used by the memory bridge. Zai reads profile + journey answers from Neon directly.
 */

/** Best-effort cap — this is a request-lifetime cache, not the system of record. */
const MAX_ENTRIES = 500

const store = new Map<string, string>()

export function setUserContextMarkdown(key: string, markdown: string): void {
  store.delete(key)
  store.set(key, markdown)
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

export function getUserContextMarkdown(key: string): string {
  return store.get(key) ?? ''
}
