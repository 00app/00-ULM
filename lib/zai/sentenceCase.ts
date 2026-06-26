/**
 * Sentence-case for Zai body copy only — capitalize after sentence ends, not mid-clause em-dashes.
 */
export function toZaiBodySentenceCase(text: string): string {
  const t = text.trim()
  if (!t) return t
  return t
    .replace(/(^|[.!?…]\s+|\n+)([a-z])/g, (_, sep, ch: string) => `${sep}${ch.toUpperCase()}`)
    .replace(/^([a-z])/, (_, ch: string) => ch.toUpperCase())
}
