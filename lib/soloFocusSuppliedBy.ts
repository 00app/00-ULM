import { parseSuppliedByProviderName } from '@/lib/soloFocusDiagnosticMeta'
import { PRICE_CAP_SOURCE_LABEL } from '@/lib/brains/constants'
import { HYBRID_LIVE_ATTRIBUTION } from '@/lib/agents/hybridLiveAttribution'

/** Reject long insight prose mistaken for a provider name (e.g. "Your home is…"). */
function looksLikeProseAttribution(s: string): boolean {
  const t = s.trim()
  if (t.length > 52) return true
  if (/\byour home is\b/i.test(t)) return true
  if (/\byour home\b/i.test(t) && t.length > 14) return true
  if (/\banswer a few questions\b/i.test(t)) return true
  if ((t.match(/\s+/g)?.length ?? 0) > 10) return true
  return false
}

/** Branded short name from a handoff / CTA https URL (e.g. eurostar.com → EUROSTAR). */
export function offerProviderFromHandoffUrl(url?: string | null): string | null {
  return hostToVerifiedProviderShort(url)
}

function hostToVerifiedProviderShort(url?: string | null): string | null {
  if (!url?.startsWith('http')) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    if (host === 'gov.uk' || host.endsWith('.gov.uk')) return 'GOV.UK'
    if (host.includes('ofgem')) return 'OFGEM'
    if (host.includes('energysavingtrust')) return 'ENERGY SAVING TRUST'
    if (host.includes('wrap.org')) return 'WRAP'
    if (host.includes('carbontrust')) return 'CARBON TRUST'
    const parts = host.split('.').filter(Boolean)
    const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    if (!base || base.length < 2) return null
    return base.replace(/-/g, ' ').toUpperCase()
  } catch {
    return null
  }
}

/**
 * Sync default for Zone / Solo Focus — never prose like "Your home…"; always a short verified-style name.
 */
export function defaultVerifiedArchitectSuppliedBy(params: {
  sourceLabel?: string | null
  sourceUrl?: string | null
}): string {
  const parsed = parseSuppliedByProviderName(params.sourceLabel)
  if (parsed && !looksLikeProseAttribution(parsed)) {
    return parsed.toUpperCase().replace(/\s+/g, ' ')
  }
  const raw = params.sourceLabel?.trim() ?? ''
  const stripped = raw.replace(/^source\.\s*/i, '').trim()
  if (stripped && !looksLikeProseAttribution(stripped)) {
    return stripped
      .split(/\s+/)
      .map((w) => w.toUpperCase())
      .join(' ')
  }
  const host = hostToVerifiedProviderShort(params.sourceUrl)
  if (host) return host
  return PRICE_CAP_SOURCE_LABEL
}

/**
 * Single attribution line for Solo Focus — every data card shows "Supplied by …".
 */
/** True when POST /api/answers merged hybrid Firecrawl + Gemini row into researchAttribution. */
export function isHybridLiveSuppliedBy(s?: string | null): boolean {
  const t = s?.trim() ?? ''
  if (!t) return false
  if (t === HYBRID_LIVE_ATTRIBUTION) return true
  return /\bLIVE DATA\b/i.test(t) && /\bVERIFIED\b/i.test(t)
}

export function resolveSuppliedByDisplayName(params: {
  researchSuppliedBy?: string | null
  /** Zone Content Architect / buildZoneViewModel verified short name */
  architectSuppliedBy?: string | null
  sourceLabel?: string | null
  /** Hostname from primary URL, or 'our partners' when unknown */
  sourceName?: string | null
  /** Primary https URL for the scraped row (optional; tightens “live” line). */
  liveScrapeSourceUrl?: string | null
}): string {
  const ra = params.researchSuppliedBy?.trim()
  if (ra) {
    if (isHybridLiveSuppliedBy(ra) && params.liveScrapeSourceUrl?.startsWith('http')) {
      const host = hostToVerifiedProviderShort(params.liveScrapeSourceUrl)
      if (host && !ra.toUpperCase().includes(host)) {
        return `${ra} · ${host}`
      }
    }
    return ra
  }
  const arch = params.architectSuppliedBy?.trim()
  if (arch) return arch
  const fromLabel = parseSuppliedByProviderName(params.sourceLabel)
  if (fromLabel) return fromLabel
  const raw = params.sourceLabel?.trim()
  const stripped = raw?.replace(/^source\.\s*/i, '').trim() ?? ''
  if (
    raw &&
    !/^supplied\s+by\s+/i.test(raw) &&
    stripped &&
    !looksLikeProseAttribution(stripped)
  ) {
    return stripped
  }
  const sn = params.sourceName?.trim()
  if (sn && sn !== 'our partners') return sn
  return PRICE_CAP_SOURCE_LABEL
}

export type SoloFocusHandoffAttribution = {
  /** Below CTA — null when no handoff URL. */
  offerProviderName: string | null
  /** Prose / auditor narrative source label. */
  sourceDisplayName: string
  /** PulseExpandedSync provider line. */
  pulseProviderName: string
}

/**
 * Single resolver for Solo Focus handoff surfaces — CTA URL wins over research attribution.
 */
export function resolveSoloFocusHandoffAttribution(params: {
  ctaUrl?: string | null
  researchSuppliedBy?: string | null
  architectSuppliedBy?: string | null
  sourceLabel?: string | null
  sourceName?: string | null
  liveScrapeSourceUrl?: string | null
}): SoloFocusHandoffAttribution {
  const researchFallback = resolveSuppliedByDisplayName({
    researchSuppliedBy: params.researchSuppliedBy,
    architectSuppliedBy: params.architectSuppliedBy,
    sourceLabel: params.sourceLabel,
    sourceName: params.sourceName,
    liveScrapeSourceUrl: params.liveScrapeSourceUrl,
  })
  const cta = params.ctaUrl?.trim()
  const fromCta = cta?.startsWith('http') ? offerProviderFromHandoffUrl(cta) : null
  if (fromCta) {
    return {
      offerProviderName: fromCta,
      sourceDisplayName: fromCta,
      pulseProviderName: fromCta,
    }
  }
  return {
    offerProviderName: null,
    sourceDisplayName: researchFallback,
    pulseProviderName: researchFallback,
  }
}
