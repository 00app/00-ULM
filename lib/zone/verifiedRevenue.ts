/**
 * v35.0 — Verified revenue URLs + CTA mapping (partner_link, source_date lock).
 */

import type { JourneyId } from '@/lib/journeys'

export const VERIFIED_SOURCE_DATE = 'April 2026'

export const PARTNER_URLS = {
  estSwitch: 'https://www.energysavingtrust.org.uk/advice/switching-energy-supplier/',
  govEco: 'https://www.gov.uk/energy-company-obligation',
  govWarmHome: 'https://www.gov.uk/apply-warm-home-discount-scheme',
  govBillCalc: 'https://www.gov.uk/estimate-energy-bills',
  ofgemCap: 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
  tflUlez: 'https://tfl.gov.uk/modes/driving/ultra-low-emission-zone',
  currysEfficient: 'https://www.currys.co.uk/search?q=energy+saving+appliances',
} as const

function isGenericHomepageUrl(url?: string): boolean {
  if (!url) return true
  try {
    const u = new URL(url)
    return u.pathname === '/' || u.pathname === ''
  } catch {
    return true
  }
}

export function isLondonPostcode(postcode?: string): boolean {
  const c = (postcode ?? '').replace(/\s+/g, '').toUpperCase()
  return /^(E|EC|N|NW|SE|SW|W|WC)\d/.test(c)
}

export function pickFirstHttpUrl(...candidates: Array<string | undefined | null>): string | undefined {
  for (const u of candidates) {
    const t = typeof u === 'string' ? u.trim() : ''
    if (t.startsWith('http') && !isGenericHomepageUrl(t)) return t
  }
  return undefined
}

export type RevenueCtaKind = 'swap' | 'grant' | 'reclaim' | 'learn' | 'apply' | 'find' | 'view'

export function resolveRevenueCtaLabel(kind: RevenueCtaKind, moneyGbp: number): string {
  switch (kind) {
    case 'swap':
      return 'Switch'
    case 'grant':
      return 'Claim'
    case 'apply':
      return 'Apply'
    case 'find':
      return 'Find'
    case 'view':
      return 'Check'
    case 'learn':
      return 'Read'
    case 'reclaim':
      return moneyGbp >= 200 ? 'Compare' : moneyGbp >= 50 ? 'Buy' : 'Read'
    default:
      return 'Read'
  }
}

export function inferRevenueCtaKind(args: {
  journey: JourneyId
  actionType: string
  needsSwitching: boolean
  isPriorityHome: boolean
}): RevenueCtaKind {
  const at = args.actionType.toLowerCase()
  if (at === 'switch' || args.needsSwitching) return 'swap'
  if (at === 'apply') return 'apply'
  if (at === 'find') return 'find'
  if (at === 'view') return 'view'
  if (at === 'buy') return 'reclaim'
  if (at === 'learn' || !at) return 'learn'
  if (args.journey === 'home' && args.isPriorityHome) return 'grant'
  return 'learn'
}

export function formatVerifiedSourceNameFromLabel(sourceLabel?: string): string {
  if (!sourceLabel?.trim()) return 'UK Government'
  const s = sourceLabel.replace(/^source\.\s*/i, '').trim()
  if (!s) return 'UK Government'
  return s
    .split(/\s+/g)
    .map((w) => {
      const up = w.toUpperCase()
      if (up === 'UK' || up === 'EST' || up === 'ULEZ' || up === 'CO2') return up === 'CO2' ? 'CO₂' : up
      if (w.length <= 3 && w === w.toUpperCase()) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

export function formatVerifiedCitation(sourceName: string, sourceDate: string): string {
  void sourceName
  void sourceDate
  return 'Source: UK Government Data April 2026'
}

export function resolvePartnerLink(args: {
  journey: JourneyId
  actionType: string
  needsSwitching: boolean
  claimOfferUrl?: string
  learnUrl: string
  actionUrl?: string
  sourceUrl: string
  variant: 'journey' | 'tip' | 'hero'
  postcode?: string
}): string {
  const pick = pickFirstHttpUrl
  const isLondon = isLondonPostcode(args.postcode)
  const at = args.actionType.toLowerCase()

  if (args.variant === 'hero') {
    return pick(args.learnUrl, args.sourceUrl) ?? PARTNER_URLS.ofgemCap
  }

  if (args.journey === 'home') {
    if (at === 'switch' || args.needsSwitching) {
      return pick(args.actionUrl, args.learnUrl, args.sourceUrl) ?? PARTNER_URLS.estSwitch
    }
    return pick(args.claimOfferUrl, args.learnUrl, args.sourceUrl) ?? PARTNER_URLS.govEco
  }

  if (args.journey === 'travel' && isLondon) {
    return PARTNER_URLS.tflUlez
  }

  if (args.variant === 'tip') {
    if (['food', 'carbon', 'money', 'shopping'].includes(args.journey)) {
      return pick(args.learnUrl, args.sourceUrl) ?? PARTNER_URLS.govBillCalc
    }
    return pick(args.learnUrl, args.sourceUrl) ?? PARTNER_URLS.currysEfficient
  }

  if (['tech', 'shopping', 'waste'].includes(args.journey)) {
    return pick(args.learnUrl, args.actionUrl, args.sourceUrl) ?? PARTNER_URLS.currysEfficient
  }

  return pick(args.learnUrl, args.sourceUrl) ?? PARTNER_URLS.govBillCalc
}
