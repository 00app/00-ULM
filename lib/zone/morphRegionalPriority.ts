import type { ZoneTipCard } from '@/lib/logic/zone'

function morphCardBlob(c: ZoneTipCard): string {
  const expl = Array.isArray(c.explanation) ? c.explanation.join(' ') : ''
  const raw = c as unknown as { description?: string }
  const desc = typeof raw.description === 'string' ? raw.description : ''
  return `${c.title} ${expl} ${desc}`.toLowerCase()
}

/** Boost morph deck tips that match the user's UK nation / region (e.g. Scotland-specific grants). */
export function prioritizeRegionalMorphCards(
  cards: ZoneTipCard[],
  regionHint: string | null | undefined
): ZoneTipCard[] {
  if (!cards.length) return cards
  const r = (regionHint || '').toLowerCase()
  const isScotland = r.includes('scotland')
  const isWales = r.includes('wales')
  const isNi = r.includes('northern ireland')

  const score = (c: ZoneTipCard) => {
    const blob = morphCardBlob(c)
    let s = 0
    if (isScotland && /scotland|holyrood|home energy|warm homes|bus pass|eco\s*4|scottish|edinburgh|glasgow/.test(blob)) {
      s += 5
    }
    if (isWales && /wales|welsh|warm nest|cartrefi/.test(blob)) s += 5
    if (isNi && /northern ireland|ni\s+energy|belfast/.test(blob)) s += 4
    if (/grant|scheme|local authority|la\s+flex|funding/.test(blob)) s += 1
    return s
  }

  return [...cards].sort((a, b) => score(b) - score(a))
}

function hasPetrolBias(profileTags: string[]): boolean {
  return profileTags.some((tag) => /(petrol|diesel|car|combustion|ice)/i.test(tag))
}

function petrolScore(c: ZoneTipCard): number {
  const blob = morphCardBlob(c)
  let s = 0
  if (/petrol|diesel|fuel|mpg|tyre|idling|pump|combustion|engine|car/i.test(blob)) s += 4
  if (/ev|chargepoint|home charging|battery/i.test(blob)) s -= 1
  return s
}

/** Profile-aware pass: when user tags indicate PETROL/CAR baseline, lift petrol-efficiency tips to the top. */
export function prioritizeMorphCardsForProfileTags(
  cards: ZoneTipCard[],
  profileTags: string[]
): ZoneTipCard[] {
  if (!cards.length || !hasPetrolBias(profileTags)) return cards
  return [...cards].sort((a, b) => petrolScore(b) - petrolScore(a))
}
