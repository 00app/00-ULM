/**
 * Copy for handing Solo Focus from one journey tile to the next after an answer,
 * when the user has no further questions in the current journey.
 */
export function pickOfferLineFromAnswerMorph(
  morphCards: unknown[] | undefined,
  discoveryWin: string | undefined,
  discovery: { recommendation_copy?: string } | undefined
): string {
  const first = Array.isArray(morphCards) && morphCards.length > 0 ? morphCards[0] : null
  if (first && typeof first === 'object') {
    const o = first as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const heading = typeof o.heading === 'string' ? o.heading.trim() : ''
    if (title) return title.slice(0, 220)
    if (heading) return heading.slice(0, 220)
    const desc = typeof o.description === 'string' ? o.description.trim() : ''
    if (desc) return desc.slice(0, 220)
  }
  const w = typeof discoveryWin === 'string' ? discoveryWin.trim() : ''
  if (w) return w.slice(0, 220)
  const rec = typeof discovery?.recommendation_copy === 'string' ? discovery.recommendation_copy.trim() : ''
  if (rec) return rec.slice(0, 220)
  return ''
}
