/**
 * Solo Focus prev/next rail — destination labels (Forensic Mate tone).
 * @see lib/zone/zoneVoice.ts — SOLO_FOCUS_NAV_LABEL_VOICE
 */

import type { JourneyId } from '@/lib/journeys'
import { formatZoneCategoryLabel, stripExpandedCardTitleNoise } from '@/lib/soloFocusCopy'

const NAV_TIP_STOP_WORDS = new Set([
  'your',
  'the',
  'a',
  'an',
  'for',
  'and',
  'or',
  'to',
  'in',
  'on',
  'at',
  'from',
  'with',
  'about',
  'how',
  'get',
  'check',
  'save',
  'this',
  'that',
  'here',
  'now',
  'week',
  'year',
])

/** Journey mother cells — UPPERCASE category (HOME, TRAVEL). */
export function formatSoloFocusNavMotherLabel(journeyKey: JourneyId): string {
  return formatZoneCategoryLabel(journeyKey)
}

/** Discovery / morph tips — lowercase title fragment; avoid echoing the mother category. */
export function singularSoloFocusNavLabel(journeyKey: JourneyId): string {
  const full = formatZoneCategoryLabel(journeyKey).toLowerCase()
  if (full === 'utilities') return 'utility'
  if (full.endsWith('ies')) return `${full.slice(0, -3)}y`
  if (full.endsWith('s')) return full.slice(0, -1)
  return full
}

/** 1–2 word nav fragment from tip title — specific, not category echo. */
export function formatSoloFocusNavTipLabel(
  title: string | null | undefined,
  journeyKey: JourneyId
): string {
  const fallback = singularSoloFocusNavLabel(journeyKey)
  const motherLower = formatZoneCategoryLabel(journeyKey).toLowerCase()
  const raw = stripExpandedCardTitleNoise(String(title ?? '')).trim()
  if (!raw) return fallback

  const words = raw
    .toLowerCase()
    .replace(/[£$]\d[\d,.]*/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9-]+$/gi, ''))
    .filter((w) => w.length > 1 && !NAV_TIP_STOP_WORDS.has(w))

  if (words.length === 0) return fallback

  const pick = (count: number) => words.slice(0, count).join(' ').trim()
  let label = pick(2)
  if (label.length > 16) label = pick(1)
  if (!label || label === fallback || label === motherLower) {
    const wider = pick(3)
    if (wider && wider !== fallback && wider !== motherLower) return wider.slice(0, 16).trim()
    return fallback
  }
  return label
}
