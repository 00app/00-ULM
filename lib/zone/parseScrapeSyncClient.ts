import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import { isAcceptableZoneJourneyHeadline, cleanZonePreviewHeadline } from '@/lib/soloFocusCopy'
import { foldCoverageRowsForZone, researchCategoryToJourneyKey } from '@/lib/zone/neonResearchMerge'
import { sanitizeArchitectProseForJourney } from '@/lib/zone/contentProseSanitize'

export function coerceMetaNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[£,\s]/g, '')
    if (!cleaned) return undefined
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : undefined
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function coerceNumOrNull(v: unknown): number | null {
  const n = coerceMetaNum(v)
  return n != null ? n : null
}

export type ParsedResearchMeta = {
  deepLink?: string
  offerUrl?: string
  verifiedSaving?: number
  savingAmountGbp?: number
  localityContext?: string
  auditSourceUrl?: string
  category?: string | null
  architectProse?: string
}

export function parseResearchMetaFromApi(data: unknown): ParsedResearchMeta | null {
  if (!data || typeof data !== 'object') return null
  const m = (data as { researchMeta?: unknown }).researchMeta
  if (!m || typeof m !== 'object') return null
  const o = m as Record<string, unknown>
  const deepLink =
    typeof o.deep_link === 'string' && o.deep_link.trim().length > 0 ? o.deep_link.trim() : undefined
  const offerUrlRaw =
    typeof o.offer_url === 'string' && o.offer_url.trim().startsWith('http') ? o.offer_url.trim() : undefined
  const verifiedSaving = coerceMetaNum(o.verified_saving)
  const savingAmountGbp = coerceMetaNum(o.saving_amount_gbp)
  const localityContext =
    typeof o.locality_context === 'string' && o.locality_context.trim().length > 0
      ? o.locality_context.trim()
      : undefined
  const auditSourceUrl =
    typeof o.audit_source_url === 'string' && o.audit_source_url.trim().startsWith('http')
      ? o.audit_source_url.trim()
      : typeof o.source_url === 'string' && o.source_url.trim().startsWith('http')
        ? o.source_url.trim()
        : undefined
  const category = typeof o.category === 'string' ? o.category.trim().toLowerCase() : null
  const architectProse =
    typeof o.architect_prose === 'string' && o.architect_prose.trim().length > 0
      ? o.architect_prose.trim()
      : undefined
  if (
    !deepLink &&
    !offerUrlRaw &&
    verifiedSaving == null &&
    savingAmountGbp == null &&
    !localityContext &&
    !auditSourceUrl &&
    !category &&
    !architectProse
  ) {
    return null
  }
  return {
    deepLink,
    offerUrl: offerUrlRaw,
    verifiedSaving,
    savingAmountGbp,
    localityContext,
    auditSourceUrl,
    category,
    architectProse,
  }
}

function coverageJourneyKey(rawKey: string): JourneyId | null {
  const k = rawKey.trim().toLowerCase()
  if ((JOURNEY_ORDER as readonly string[]).includes(k)) return k as JourneyId
  return researchCategoryToJourneyKey(k)
}

export function parseCoverageFromApi(data: unknown): Record<string, ResearchCategoryCoverageRow> | null {
  if (!data || typeof data !== 'object') return null
  const rawCov = (data as { research_category_coverage?: unknown }).research_category_coverage
  if (!rawCov || typeof rawCov !== 'object' || Array.isArray(rawCov)) return null
  const next: Record<string, ResearchCategoryCoverageRow> = {}
  for (const [k, v] of Object.entries(rawCov as Record<string, unknown>)) {
    const key = k.trim().toLowerCase()
    if (!key || typeof v !== 'object' || !v) continue
    const o = v as Record<string, unknown>
    const jid = coverageJourneyKey(key)
    const apRaw =
      typeof o.architectProse === 'string' && o.architectProse.trim().length > 0
        ? o.architectProse.trim()
        : null
    const ap = jid && apRaw ? sanitizeArchitectProseForJourney(jid, apRaw) : apRaw
    const hlRaw =
      typeof o.agentHeadline === 'string' && o.agentHeadline.trim().length > 0
        ? o.agentHeadline.trim()
        : null
    let hl: string | null = null
    if (hlRaw) {
      const cleaned = cleanZonePreviewHeadline(hlRaw)
      if (jid ? isAcceptableZoneJourneyHeadline(jid, cleaned) : cleaned.length > 0) {
        hl = cleaned
      }
    }
    next[key] = {
      insightReady: Boolean(o.insightReady),
      hasOffer: Boolean(o.hasOffer),
      verified: Boolean(o.verified),
      latestSavingGbp: coerceNumOrNull(o.latestSavingGbp),
      latestVerifiedGbp: coerceNumOrNull(o.latestVerifiedGbp),
      latestOfferUrl: typeof o.latestOfferUrl === 'string' ? o.latestOfferUrl : null,
      latestSourceUrl: typeof o.latestSourceUrl === 'string' ? o.latestSourceUrl : null,
      architectProse: ap,
      agentHeadline: hl,
    }
  }
  return Object.keys(next).length > 0 ? next : null
}

/** Fold legacy Neon `bills` / `general` aliases onto Zone journey keys before VM build. */
export function parseZoneCoverageFromApi(data: unknown): Record<string, ResearchCategoryCoverageRow> | null {
  const raw = parseCoverageFromApi(data)
  if (!raw) return null
  return foldCoverageRowsForZone(raw)
}

export function researchTicksFromPayload(
  meta: ParsedResearchMeta | null,
  coverage: Record<string, ResearchCategoryCoverageRow> | null
): { moneyOk: boolean; proseOk: boolean; offerOk: boolean; moneyHint: string | null } {
  const covRows = coverage ? Object.values(coverage) : []
  const moneyOk =
    (meta?.verifiedSaving != null && meta.verifiedSaving > 0) ||
    (meta?.savingAmountGbp != null && meta.savingAmountGbp > 0) ||
    covRows.some((c) => (c.latestSavingGbp ?? 0) > 0 || (c.latestVerifiedGbp ?? 0) > 0)
  const proseOk =
    Boolean(meta?.architectProse?.trim()) ||
    covRows.some((c) => c.insightReady) ||
    covRows.some((c) => Boolean(c.architectProse?.trim()) || Boolean(c.agentHeadline?.trim()))
  const offerOk =
    Boolean(meta?.offerUrl?.trim()) || covRows.some((c) => c.hasOffer)
  const moneyHint =
    meta?.verifiedSaving != null && meta.verifiedSaving > 0
      ? `verified_saving ≈ £${Math.round(meta.verifiedSaving).toLocaleString('en-GB')}`
      : meta?.savingAmountGbp != null && meta.savingAmountGbp > 0
        ? `saving_amount_gbp £${Math.round(meta.savingAmountGbp).toLocaleString('en-GB')}`
        : covRows.some((c) => (c.latestSavingGbp ?? 0) > 0 || (c.latestVerifiedGbp ?? 0) > 0)
          ? 'per-category rows in research_results'
          : null
  return { moneyOk, proseOk, offerOk, moneyHint }
}
