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

/** Host -> Awin advertiser (merchant) ID, for programs actually approved on the account. */
const AWIN_MERCHANT_IDS: Record<string, string> = {
  // 'octopus.energy': '00000',
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

/** Merchant ID for this destination's host, if the account has an approved program for it. */
export function awinMerchantIdForUrl(url: string): string | null {
  const host = hostOf(url)
  return host ? (AWIN_MERCHANT_IDS[host] ?? null) : null
}

/**
 * Wraps destinationUrl in an Awin tracked deep link when both a publisher ID and a merchant
 * mapping exist; otherwise returns destinationUrl unchanged. clickref is Awin's free-text
 * publisher-side tracking field — pass through something that identifies where the click came
 * from (journey key, card id) so conversions can be attributed inside the Awin dashboard.
 */
export function wrapWithAwinAffiliateLink(
  destinationUrl: string,
  clickref?: string | null
): string {
  const trimmed = typeof destinationUrl === 'string' ? destinationUrl.trim() : ''
  if (!trimmed.startsWith('https://')) return destinationUrl

  const publisherId = resolveAwinPublisherId()
  if (!publisherId) return destinationUrl

  const merchantId = awinMerchantIdForUrl(trimmed)
  if (!merchantId) return destinationUrl

  const params = new URLSearchParams({
    awinmid: merchantId,
    awinaffid: publisherId,
    p: trimmed,
  })
  if (clickref?.trim()) params.set('clickref', clickref.trim().slice(0, 100))

  return `https://www.awin1.com/cread.php?${params.toString()}`
}
