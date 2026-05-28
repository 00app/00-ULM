import { isRealLocalityLabel } from '@/lib/brains/summaryLogic'

const UK_POSTCODE_INLINE_RE = /\b[A-Z]{1,2}\d[A-Z0-9]?\s*\d[A-Z]{2}\b/gi

export function stripPostcodeTokensFromText(value: string): string {
  return value
    .replace(UK_POSTCODE_INLINE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function looksLikeUkPostcodeToken(value: string): boolean {
  const compact = value.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{1,2}\d[A-Z0-9]?\d[A-Z]{2}$/.test(compact)
}

/** Human place label for Solo Focus — town/area, never a raw postcode in prose. */
export function resolveSoloFocusPlaceLabel(params: {
  locality?: string | null
  postcode?: string | null
}): string {
  const fromLocality = stripPostcodeTokensFromText(String(params.locality ?? '').trim())
  if (fromLocality && isRealLocalityLabel(fromLocality)) {
    return fromLocality
  }
  const pc = String(params.postcode ?? '').trim()
  if (pc && !looksLikeUkPostcodeToken(pc) && isRealLocalityLabel(pc)) {
    return stripPostcodeTokensFromText(pc)
  }
  return 'your area'
}

/** Swap postcode tokens in the Marvin lead for the resolved town label. */
export function personalizeTrueTipPlaceLead(
  paragraphs: [string, string, string],
  params: { locality?: string | null; postcode?: string | null }
): [string, string, string] {
  const place = resolveSoloFocusPlaceLabel(params)
  const pcCompact = String(params.postcode ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
  let lead = paragraphs[0] ?? ''
  if (pcCompact.length >= 5) {
    lead = lead.replace(new RegExp(pcCompact, 'gi'), place)
    lead = lead.replace(
      new RegExp(`\\bAround\\s+${pcCompact}\\b`, 'gi'),
      place === 'your area' ? 'Around your area' : `In ${place}`
    )
  }
  lead = lead.replace(UK_POSTCODE_INLINE_RE, place === 'your area' ? 'your area' : place)
  if (place !== 'your area') {
    lead = lead.replace(/\byour postcode\b/gi, place)
    lead = lead.replace(/\bAround your area\b/gi, `In ${place}`)
  }
  return [lead, paragraphs[1] ?? '', paragraphs[2] ?? '']
}
