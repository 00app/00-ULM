/**
 * In-memory store for the last flushed user context markdown.
 * Used by the memory bridge. Zai reads profile + journey answers from Neon directly.
 */
let lastUserContextMarkdown = ''

export function setUserContextMarkdown(markdown: string): void {
  lastUserContextMarkdown = markdown
}

export function getUserContextMarkdown(): string {
  return lastUserContextMarkdown
}
