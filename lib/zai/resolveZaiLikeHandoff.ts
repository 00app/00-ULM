import { isValidJourneyId, type JourneyId } from '@/lib/journeys'
import {
  inferRevenueCtaKind,
  pickFirstHttpUrl,
  resolvePartnerLink,
  resolveRevenueCtaLabel,
} from '@/lib/zone/verifiedRevenue'
import type { ZaiLikeRecord } from '@/lib/zai/zaiLikesStorage'

function journeyFromKey(key: string): JourneyId {
  const k = String(key ?? '').trim().toLowerCase()
  return isValidJourneyId(k) ? k : 'home'
}

/** Map Zai pick copy + URL to Claim / Buy / Get (same rail as Solo Focus). */
export function inferZaiCtaLabel(journeyKey: string, title: string, offerUrl?: string): string {
  const t = title.toLowerCase()
  const url = (offerUrl ?? '').toLowerCase()
  const journey = journeyFromKey(journeyKey)
  if (/\b(grant|eco|bus|scheme|eligib|warm home|insulation grant)\b/.test(t) || /\b(gov\.uk|grant)\b/.test(url)) {
    return resolveRevenueCtaLabel('grant', 0)
  }
  if (/\b(switch|tariff|supplier|rail|compare)\b/.test(t)) {
    return resolveRevenueCtaLabel('swap', 0)
  }
  const kind = inferRevenueCtaKind({
    journey,
    actionType: '',
    needsSwitching: false,
    isPriorityHome: journey === 'home',
  })
  return resolveRevenueCtaLabel(kind, 0)
}

export type ZaiPickHandoff = {
  offerUrl: string
  ctaLabel: string
}

/** Resolve handoff for a liked Zai pick — stored URL first, then verified partner fallback. */
export function resolveZaiPickHandoff(
  pick: ZaiLikeRecord,
  postcode?: string | null
): ZaiPickHandoff {
  const journey = journeyFromKey(pick.journey_key)
  const stored = pickFirstHttpUrl(pick.offerUrl, pick.sourceUrl)
  if (stored) {
    return {
      offerUrl: stored,
      ctaLabel: pick.ctaLabel?.trim() || inferZaiCtaLabel(journey, pick.title, stored),
    }
  }
  const fallback = resolvePartnerLink({
    journey,
    actionType: /\b(switch|tariff)\b/i.test(pick.title) ? 'switch' : '',
    needsSwitching: /\b(switch|tariff)\b/i.test(pick.title),
    learnUrl: '',
    sourceUrl: '',
    variant: 'tip',
    postcode: postcode ?? undefined,
  })
  return {
    offerUrl: fallback,
    ctaLabel: pick.ctaLabel?.trim() || inferZaiCtaLabel(journey, pick.title, fallback),
  }
}
