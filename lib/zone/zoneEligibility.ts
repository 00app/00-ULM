import type { ZoneTipCard } from '@/lib/logic/zone'

const MEANS_TESTED_RE = /\b(eco4|eco\s*4|bus\s+grant|income[\s-]?related|benefit|means[\s-]?test|warm\s+home)\b/i

export function isActiveEmployed(employmentStatus?: string | null): boolean {
  const s = String(employmentStatus ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
  return (
    s === 'EMPLOYED' ||
    s === 'FULL_TIME' ||
    s === 'PART_TIME' ||
    s === 'SELF_EMPLOYED' ||
    s === 'EMPLOYED_FULL_TIME' ||
    s === 'EMPLOYED_PART_TIME'
  )
}

/** High-value outward districts — asset-optimization tone (not survival). */
export function isHighValuePostcode(postcode?: string | null): boolean {
  const pc = String(postcode ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
  if (!pc) return false
  const affluentOutward = ['SW1', 'SW3', 'SW7', 'W8', 'W1', 'EC1', 'EC2', 'GU25', 'KT20', 'RH8']
  return affluentOutward.some((p) => pc.startsWith(p))
}

export function filterTipsForEmployment(
  tips: ZoneTipCard[],
  employmentStatus?: string | null,
  imdDecile?: number | null
): ZoneTipCard[] {
  const deprioritizeMeansTested =
    isActiveEmployed(employmentStatus) ||
    (typeof imdDecile === 'number' && imdDecile >= 8)
  if (!deprioritizeMeansTested) return tips
  return tips.filter((t) => {
    const blob = `${t.title ?? ''} ${t.explanation?.join(' ') ?? ''} ${t.journey_key ?? ''}`.toLowerCase()
    if (t.journey_key === 'grants' && MEANS_TESTED_RE.test(blob)) return false
    return !MEANS_TESTED_RE.test(blob)
  })
}

export function grantsJourneyTitleForProfile(args: {
  employmentStatus?: string | null
  postcode?: string | null
  defaultTitle: string
}): string {
  if (isHighValuePostcode(args.postcode)) {
    return 'optimise assets and legacy efficiency'
  }
  if (isActiveEmployed(args.employmentStatus)) {
    return 'productivity and investment-grade upgrades'
  }
  return args.defaultTitle
}
