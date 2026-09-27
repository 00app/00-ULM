/**
 * v2 — Three colours only, exactly as sampled from the Figma file: blue, navy, white.
 * Navy is never a card fill (ambient/page use only). Unvisited cards = solid blue + white
 * ink. Visited cards = white + blue ink (see .zone-card--visited in globals.css). CTA fills
 * = solid blue + white ink.
 */

import type { JourneyId } from '@/lib/journeys'

export const COLOR_BLUE = '#000AFF'
export const COLOR_PURPLE = '#141268'
export const COLOR_WHITE = '#FCFCFF'
export const COLOR_SOFT_CREAM = '#141268'

export interface JourneyColorEntry {
  journey: JourneyId
  keyword: string
  name: string
  hex: string
  textHex: string
  usage: string
}

/** Card background: blue, unvisited default for every category */
export const EMOTION_GRID_HEX: Record<JourneyId, string> = {
  home: COLOR_BLUE,
  utilities: COLOR_BLUE,
  solar: COLOR_BLUE,
  travel: COLOR_BLUE,
  holidays: COLOR_BLUE,
  food: COLOR_BLUE,
  shopping: COLOR_BLUE,
  money: COLOR_BLUE,
  tech: COLOR_BLUE,
  water: COLOR_BLUE,
  waste: COLOR_BLUE,
  carbon: COLOR_BLUE,
}

/** Body copy on card: white ink on the blue surface */
export const EMOTION_TEXT_HEX: Record<JourneyId, string> = {
  home: COLOR_WHITE,
  utilities: COLOR_WHITE,
  solar: COLOR_WHITE,
  travel: COLOR_WHITE,
  holidays: COLOR_WHITE,
  food: COLOR_WHITE,
  shopping: COLOR_WHITE,
  money: COLOR_WHITE,
  tech: COLOR_WHITE,
  water: COLOR_WHITE,
  waste: COLOR_WHITE,
  carbon: COLOR_WHITE,
}

/** CTA fill (contrasts card surface) — white pill on the blue card */
export const EMOTION_CTA_BG_HEX: Record<JourneyId, string> = {
  home: COLOR_WHITE,
  utilities: COLOR_WHITE,
  solar: COLOR_WHITE,
  travel: COLOR_WHITE,
  holidays: COLOR_WHITE,
  food: COLOR_WHITE,
  shopping: COLOR_WHITE,
  money: COLOR_WHITE,
  tech: COLOR_WHITE,
  water: COLOR_WHITE,
  waste: COLOR_WHITE,
  carbon: COLOR_WHITE,
}

/** CTA label on CTA fill — blue on white (white bg needs blue ink, ~8.4:1) */
export const EMOTION_CTA_TEXT_HEX: Record<JourneyId, string> = {
  home: COLOR_BLUE,
  utilities: COLOR_BLUE,
  solar: COLOR_BLUE,
  travel: COLOR_BLUE,
  holidays: COLOR_BLUE,
  food: COLOR_BLUE,
  shopping: COLOR_BLUE,
  money: COLOR_BLUE,
  tech: COLOR_BLUE,
  water: COLOR_BLUE,
  waste: COLOR_BLUE,
  carbon: COLOR_BLUE,
}

/** @deprecated Use EMOTION_CTA_BG_HEX — kept for callers still on “accent” naming */
export const EMOTION_ACCENT_HEX: Record<JourneyId, string> = {
  home: EMOTION_CTA_BG_HEX.home,
  utilities: EMOTION_CTA_BG_HEX.utilities,
  solar: EMOTION_CTA_BG_HEX.solar,
  travel: EMOTION_CTA_BG_HEX.travel,
  holidays: EMOTION_CTA_BG_HEX.holidays,
  food: EMOTION_CTA_BG_HEX.food,
  shopping: EMOTION_CTA_BG_HEX.shopping,
  money: EMOTION_CTA_BG_HEX.money,
  tech: EMOTION_CTA_BG_HEX.tech,
  water: EMOTION_CTA_BG_HEX.water,
  waste: EMOTION_CTA_BG_HEX.waste,
  carbon: EMOTION_CTA_BG_HEX.carbon,
}

export const HERO_GRID_HEX = COLOR_BLUE
export const HERO_ACCENT_HEX = COLOR_WHITE
export const SOFT_CREAM_HEX = COLOR_SOFT_CREAM
export const GENERAL_ACCENT_HEX = COLOR_BLUE

export const JOURNEY_COLOR_MAP: Record<JourneyId, JourneyColorEntry> = {
  home: { journey: 'home', keyword: 'solar-panels', name: 'Home', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  utilities: {
    journey: 'utilities',
    keyword: 'gas-electric-meter',
    name: 'Utilities',
    hex: COLOR_BLUE,
    textHex: COLOR_WHITE,
    usage: '',
  },
  solar: { journey: 'solar', keyword: 'roof-solar', name: 'Solar', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  travel: { journey: 'travel', keyword: 'electric-car', name: 'Travel', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  holidays: { journey: 'holidays', keyword: 'railway', name: 'Holidays', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  food: { journey: 'food', keyword: 'vegetables', name: 'Food', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  shopping: { journey: 'shopping', keyword: 'second-hand-clothing', name: 'Shopping', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  money: { journey: 'money', keyword: 'savings-account', name: 'Money', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  tech: { journey: 'tech', keyword: 'electronics-repair', name: 'Tech', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  water: { journey: 'water', keyword: 'rainwater', name: 'Water', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  waste: { journey: 'waste', keyword: 'composting', name: 'Waste', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
  carbon: { journey: 'carbon', keyword: 'forest', name: 'Carbon', hex: COLOR_BLUE, textHex: COLOR_WHITE, usage: '' },
}

export function getExpandedAccentHex(journeyId: JourneyId): string {
  return EMOTION_ACCENT_HEX[journeyId] ?? GENERAL_ACCENT_HEX
}

export function getJourneyColorVar(journey: JourneyId): string {
  return `var(--color-j-${journey})`
}

export function getJourneyColorHex(journey: JourneyId): string {
  return JOURNEY_COLOR_MAP[journey]?.hex ?? COLOR_BLUE
}

/** Text on journey card surface */
export function getJourneyCardTextHex(journeyId: JourneyId): string {
  return JOURNEY_COLOR_MAP[journeyId]?.textHex ?? COLOR_WHITE
}

export function getJourneyCtaBgHex(journeyId: JourneyId): string {
  return EMOTION_CTA_BG_HEX[journeyId] ?? COLOR_WHITE
}

export function getJourneyCtaTextHex(journeyId: JourneyId): string {
  return EMOTION_CTA_TEXT_HEX[journeyId] ?? COLOR_BLUE
}

/** System shell — blue CTAs, white label */
export function getSystemCtaBgHex(): string {
  return COLOR_BLUE
}

export function getSystemCtaTextHex(): string {
  return COLOR_WHITE
}

/** Zone wall + Solo Focus: journey and tip tiles share the same blue/white surface rule. */
export type ZoneSurfaceKind = 'journey' | 'tip'

export interface ZoneSurfaceTokens {
  bg: string
  text: string
  ink: string
  ctaBg: string
  ctaText: string
  answerBg: string
  answerText: string
  answerHoverBg: string
  answerHoverText: string
}

export function resolveZoneSurfaceKind(opts: {
  isTipTile?: boolean
  journeyId?: string | null
  cardId?: string | null
  category?: string | null
}): ZoneSurfaceKind {
  if (opts.isTipTile) return 'tip'
  const id = String(opts.cardId ?? opts.journeyId ?? '')
    .trim()
    .toLowerCase()
  if (id === 'settings') return 'tip'
  const cat = String(opts.category ?? '')
    .trim()
    .toLowerCase()
  if (cat === 'tips' || cat === 'tip') return 'tip'
  return 'journey'
}

export function getZoneSurfaceTokens(_kind: ZoneSurfaceKind): ZoneSurfaceTokens {
  // v2: journey and tip both use the blue/white-ink default — no per-kind branch needed, navy
  // is never a card fill. Visited state (white/blue) is applied separately via
  // .zone-card--visited in globals.css, not from this function.
  return {
    bg: COLOR_BLUE,
    text: COLOR_WHITE,
    ink: COLOR_WHITE,
    ctaBg: COLOR_WHITE,
    ctaText: COLOR_BLUE,
    answerBg: COLOR_WHITE,
    answerText: COLOR_BLUE,
    answerHoverBg: COLOR_WHITE,
    answerHoverText: COLOR_BLUE,
  }
}

/** Expanded Solo Focus — typographic HUD over Zone atmosphere (no card fill). */
export function zoneExpandedJourneySurfaceStyleProps(): Record<string, string> {
  return {
    '--journey-bg': 'transparent',
    '--journey-text': COLOR_BLUE,
    '--color-ink': COLOR_BLUE,
    '--journey-accent': COLOR_BLUE,
    '--journey-on-accent': COLOR_WHITE,
    '--journey-cta-bg': COLOR_BLUE,
    '--journey-cta-text': COLOR_WHITE,
    '--sf-answer-bg': COLOR_BLUE,
    '--sf-answer-text': COLOR_WHITE,
    '--sf-answer-hover-bg': COLOR_WHITE,
    '--sf-answer-hover-text': COLOR_BLUE,
  }
}

/** CSS custom properties for bento / expanded Solo Focus shells. */
export function zoneSurfaceStyleProps(kind: ZoneSurfaceKind): Record<string, string> {
  const t = getZoneSurfaceTokens(kind)
  return {
    '--journey-bg': t.bg,
    '--journey-text': t.text,
    '--color-ink': t.ink,
    '--journey-accent': t.ctaBg,
    '--journey-on-accent': t.ctaText,
    '--journey-cta-bg': t.ctaBg,
    '--journey-cta-text': t.ctaText,
    '--sf-answer-bg': t.answerBg,
    '--sf-answer-text': t.answerText,
    '--sf-answer-hover-bg': t.answerHoverBg,
    '--sf-answer-hover-text': t.answerHoverText,
  }
}

export const emotionColorMap = {
  hero: { grid: HERO_GRID_HEX, accent: HERO_ACCENT_HEX },
  home: { grid: EMOTION_GRID_HEX.home, accent: EMOTION_ACCENT_HEX.home },
  travel: { grid: EMOTION_GRID_HEX.travel, accent: EMOTION_ACCENT_HEX.travel },
  food: { grid: EMOTION_GRID_HEX.food, accent: EMOTION_ACCENT_HEX.food },
  shopping: { grid: EMOTION_GRID_HEX.shopping, accent: EMOTION_ACCENT_HEX.shopping },
  money: { grid: EMOTION_GRID_HEX.money, accent: EMOTION_ACCENT_HEX.money },
  carbon: { grid: EMOTION_GRID_HEX.carbon, accent: EMOTION_ACCENT_HEX.carbon },
  tech: { grid: EMOTION_GRID_HEX.tech, accent: EMOTION_ACCENT_HEX.tech },
  waste: { grid: EMOTION_GRID_HEX.waste, accent: EMOTION_ACCENT_HEX.waste },
  holidays: { grid: EMOTION_GRID_HEX.holidays, accent: EMOTION_ACCENT_HEX.holidays },
  general: { grid: COLOR_BLUE, accent: GENERAL_ACCENT_HEX },
} as const

export const PROFILE_QUESTION_EMOTION_BG: Record<string, string> = {
  name: COLOR_WHITE,
  postcode: COLOR_WHITE,
  livingSituation: COLOR_WHITE,
  homeType: COLOR_WHITE,
  transport: COLOR_WHITE,
  age: COLOR_WHITE,
}
