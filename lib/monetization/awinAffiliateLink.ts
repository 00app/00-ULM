/**
 * Awin affiliate link wrapping — applied once, at click time, after a destination URL has
 * already been resolved and guard-checked (offerUrlGuard.ts). Not a URL source of its own.
 *
 * Inert until both NEXT_PUBLIC_AWIN_PUBLISHER_ID is set and the destination host has a merchant
 * mapping — safe to deploy before either exists. Populate AWIN_MERCHANT_IDS with real awinmid
 * values from the Awin dashboard ("My Advertisers") as programs get approved; do not guess.
 *
 * NEXT_PUBLIC_ prefix is required, not optional: every call site (IndustrialHandoffButton,
 * openZoneExternalHandoff, openOfferUrlInNewTab) runs inside a browser click handler, and
 * Next.js strips plain (non-NEXT_PUBLIC_) process.env reads from client bundles — a bare
 * AWIN_PUBLISHER_ID would silently always resolve to undefined here. This isn't a new exposure:
 * the publisher ID ends up embedded in every clicked awin1.com URL regardless, so it was never
 * meaningfully secret.
 */

/**
 * Host -> Awin advertiser (merchant) ID, for programs actually approved on the account.
 *
 * Most hosts run a single Awin programme — plain string mid. A host that runs more than one
 * (e.g. moneysupermarket.com has separate Energy and Money programmes, each with its own mid)
 * uses an object keyed by journey id instead; awinMerchantIdForUrl resolves it against whichever
 * journey the click came from. A journey with no entry for that host resolves to no mid at all
 * (never falls back to some other journey's mid, which would misroute commission).
 */
const AWIN_MERCHANT_IDS: Record<string, string | Partial<Record<string, string>>> = {
  // 'octopus.energy': '00000',

  // moneysupermarket.com runs separate Energy and Money programmes on Awin. utilities is this
  // app's tariff-switching journey (Energy programme); money is banking/savings (Money
  // programme). Any other journey linking to moneysupermarket.com resolves to no mid.
  'moneysupermarket.com': {
    utilities: '22713', // Energy programme
    money: '61791', // Money programme
  },

  'backmarket.co.uk': '25205',
  'podpoint.com': '73493',

  // --- Pending Awin approval — mid not yet confirmed. Do not guess a mid or a domain; both
  // stay commented until the real mid is pasted back (GET /publishers/2943149/programmes). ---
  // 'TODO': 'TODO', // BT Broadband — utilities
  // 'TODO': 'TODO', // Railcard — travel
  // 'TODO': 'TODO', // Rail Discoveries — holidays
  // 'TODO': 'TODO', // Project Solar UK — solar
  // 'TODO': 'TODO', // Phones Direct — shopping/tech
  // 'TODO': 'TODO', // AO Mobile Phones Direct — tech
  // 'TODO': 'TODO', // Insulation & More — home
  // 'TODO': 'TODO', // Clove Recycling — waste
  // 'TODO': 'TODO', // EV King - Electric Car Charging Accessories — travel
}

function resolveAwinPublisherId(): string | null {
  const id = process.env.NEXT_PUBLIC_AWIN_PUBLISHER_ID?.trim() ?? ''
  return id.length > 0 ? id : null
}

function hostOf(url: string): string {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Merchant ID for this destination's host, if the account has an approved program for it.
 * journeyKey disambiguates multi-programme hosts (see moneysupermarket.com above) — a journey
 * with no entry for that host resolves to no mid, it never falls back to a different journey's.
 */
export function awinMerchantIdForUrl(url: string, journeyKey?: string | null): string | null {
  const host = hostOf(url)
  if (!host) return null
  const entry = AWIN_MERCHANT_IDS[host]
  if (entry == null) return null
  if (typeof entry === 'string') return entry
  const key = journeyKey?.trim()
  return key ? (entry[key] ?? null) : null
}

/**
 * Wraps destinationUrl in an Awin tracked deep link when both a publisher ID and a merchant
 * mapping exist; otherwise returns destinationUrl unchanged. clickref is Awin's free-text
 * publisher-side tracking field — pass through something that identifies where the click came
 * from (journey key, card id) so conversions can be attributed inside the Awin dashboard.
 * journeyKey is separate from clickref (which callers may set to a card id, not a journey) —
 * pass the journey the click actually came from so multi-programme hosts resolve correctly.
 */
export function wrapWithAwinAffiliateLink(
  destinationUrl: string,
  clickref?: string | null,
  journeyKey?: string | null
): string {
  const trimmed = typeof destinationUrl === 'string' ? destinationUrl.trim() : ''
  if (!trimmed.startsWith('https://')) return destinationUrl

  const publisherId = resolveAwinPublisherId()
  if (!publisherId) return destinationUrl

  const merchantId = awinMerchantIdForUrl(trimmed, journeyKey)
  if (!merchantId) return destinationUrl

  const params = new URLSearchParams({
    awinmid: merchantId,
    awinaffid: publisherId,
    p: trimmed,
  })
  if (clickref?.trim()) params.set('clickref', clickref.trim().slice(0, 100))

  return `https://www.awin1.com/cread.php?${params.toString()}`
}
