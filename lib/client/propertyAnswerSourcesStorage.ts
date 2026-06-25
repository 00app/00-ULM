/**
 * Client-side property answer source attribution (Solo Focus pre-fills).
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import type { PropertyAnswerSourcesMap } from '@/lib/intelligence/propertyIntelligenceTypes'
import { attributionLabelForSource } from '@/lib/intelligence/propertyAnswerPrefill'
import { persistHomePowerFromProfile } from '@/lib/profile/homePower'

const STORAGE_KEY = 'property_answer_sources'

export function persistPropertyAnswerSources(sources: PropertyAnswerSourcesMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources))
  } catch {
    /* ignore */
  }
}

export function readPropertyAnswerSources(): PropertyAnswerSourcesMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PropertyAnswerSourcesMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function readPropertyIntelligenceConfidence(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('property_intelligence_confidence')
  } catch {
    return null
  }
}

export function persistPropertyIntelligenceMeta(confidence: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('property_intelligence_confidence', confidence)
  } catch {
    /* ignore */
  }
}

export function attributionForQuestion(
  journeyId: JourneyId,
  questionId: string
): string | null {
  const sources = readPropertyAnswerSources()
  const source = sources[journeyId]?.[questionId]
  return attributionLabelForSource(source)
}

export function applyPropertyPrefillFromApiResponse(res: {
  property_intelligence?: {
    confidence?: string
    deprivation?: { imdDecile?: number }
  } | null
  property_prefill?: {
    answers?: Partial<Record<JourneyId, Record<string, string>>>
    sources?: PropertyAnswerSourcesMap
    home_power?: string
  } | null
}): void {
  if (typeof window === 'undefined') return
  const confidence = res?.property_intelligence?.confidence
  if (confidence) persistPropertyIntelligenceMeta(confidence)

  const imd = res?.property_intelligence?.deprivation?.imdDecile
  if (typeof imd === 'number' && Number.isFinite(imd)) {
    try {
      localStorage.setItem('property_imd_decile', String(imd))
    } catch {
      /* ignore */
    }
  }

  if (res?.property_intelligence?.confidence) {
    try {
      const snap = {
        ...res.property_intelligence,
        enrichedAt: new Date().toISOString(),
      }
      localStorage.setItem('property_intelligence_snapshot', JSON.stringify(snap))
    } catch {
      /* ignore */
    }
  }

  const prefill = res?.property_prefill
  if (!prefill) return

  if (prefill.sources && Object.keys(prefill.sources).length > 0) {
    persistPropertyAnswerSources(prefill.sources)
  }

  if (prefill.home_power?.trim()) {
    persistHomePowerFromProfile(prefill.home_power.trim())
  }

  const answers = prefill.answers
  if (!answers || typeof answers !== 'object') return

  for (const jid of JOURNEY_ORDER) {
    const patch = answers[jid]
    if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) continue
    const key = `journey_${jid}_answers`
    try {
      const prevRaw = localStorage.getItem(key)
      const prev = prevRaw ? (JSON.parse(prevRaw) as Record<string, string>) : {}
      localStorage.setItem(key, JSON.stringify({ ...prev, ...patch }))
    } catch {
      localStorage.setItem(key, JSON.stringify(patch))
    }
  }
  window.dispatchEvent(new Event('storage'))
}
