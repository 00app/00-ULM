/**
 * v1.8.3 — Industrial legibility lock (4 colours only):
 * Purple journey cards → yellow type/icons/arrows; CTAs yellow fill + purple label.
 * Overlays use the same yellow / pink / purple surfaces — no neutral white type.
 */

import type { JourneyId } from '@/lib/journeys'

export const COLOR_YELLOW = '#FFD700'
export const COLOR_PURPLE = '#141268'
export const COLOR_PINK = '#FF00FF'
export const COLOR_SOFT_CREAM = '#141268'

export interface JourneyColorEntry {
  journey: JourneyId
  keyword: string
  name: string
  hex: string
  textHex: string
  usage: string
}

/** Card background: MVP purple flip */
export const EMOTION_GRID_HEX: Record<JourneyId, string> = {
  home: COLOR_PURPLE,
  utilities: COLOR_PURPLE,
  solar: COLOR_PURPLE,
  travel: COLOR_PURPLE,
  holidays: COLOR_PURPLE,
  food: COLOR_PURPLE,
  shopping: COLOR_PURPLE,
  money: COLOR_PURPLE,
  tech: COLOR_PURPLE,
  water: COLOR_PURPLE,
  waste: COLOR_PURPLE,
  carbon: COLOR_PURPLE,
}

/** Body copy on card: yellow surface → purple; pink surface → yellow */
export const EMOTION_TEXT_HEX: Record<JourneyId, string> = {
  home: COLOR_YELLOW,
  utilities: COLOR_YELLOW,
  solar: COLOR_YELLOW,
  travel: COLOR_YELLOW,
  holidays: COLOR_YELLOW,
  food: COLOR_YELLOW,
  shopping: COLOR_YELLOW,
  money: COLOR_YELLOW,
  tech: COLOR_YELLOW,
  water: COLOR_YELLOW,
  waste: COLOR_YELLOW,
  carbon: COLOR_YELLOW,
}

/** CTA fill (contrasts card surface) */
export const EMOTION_CTA_BG_HEX: Record<JourneyId, string> = {
  home: COLOR_YELLOW,
  utilities: COLOR_YELLOW,
  solar: COLOR_YELLOW,
  travel: COLOR_YELLOW,
  holidays: COLOR_YELLOW,
  food: COLOR_YELLOW,
  shopping: COLOR_YELLOW,
  money: COLOR_YELLOW,
  tech: COLOR_YELLOW,
  water: COLOR_YELLOW,
  waste: COLOR_YELLOW,
  carbon: COLOR_YELLOW,
}

/** CTA label on CTA fill */
export const EMOTION_CTA_TEXT_HEX: Record<JourneyId, string> = {
  home: COLOR_PURPLE,
  utilities: COLOR_PURPLE,
  solar: COLOR_PURPLE,
  travel: COLOR_PURPLE,
  holidays: COLOR_PURPLE,
  food: COLOR_PURPLE,
  shopping: COLOR_PURPLE,
  money: COLOR_PURPLE,
  tech: COLOR_PURPLE,
  water: COLOR_PURPLE,
  waste: COLOR_PURPLE,
  carbon: COLOR_PURPLE,
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

export const HERO_GRID_HEX = COLOR_PURPLE
export const HERO_ACCENT_HEX = COLOR_YELLOW
export const SOFT_CREAM_HEX = COLOR_SOFT_CREAM
export const GENERAL_ACCENT_HEX = COLOR_YELLOW

export const JOURNEY_COLOR_MAP: Record<JourneyId, JourneyColorEntry> = {
  home: { journey: 'home', keyword: 'solar-panels', name: 'Home', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  utilities: {
    journey: 'utilities',
    keyword: 'gas-electric-meter',
    name: 'Utilities',
    hex: COLOR_PURPLE,
    textHex: COLOR_YELLOW,
    usage: '',
  },
  solar: { journey: 'solar', keyword: 'roof-solar', name: 'Solar', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  travel: { journey: 'travel', keyword: 'electric-car', name: 'Travel', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  holidays: { journey: 'holidays', keyword: 'railway', name: 'Holidays', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  food: { journey: 'food', keyword: 'vegetables', name: 'Food', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  shopping: { journey: 'shopping', keyword: 'second-hand-clothing', name: 'Shopping', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  money: { journey: 'money', keyword: 'savings-account', name: 'Money', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  tech: { journey: 'tech', keyword: 'electronics-repair', name: 'Tech', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  water: { journey: 'water', keyword: 'rainwater', name: 'Water', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  waste: { journey: 'waste', keyword: 'composting', name: 'Waste', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
  carbon: { journey: 'carbon', keyword: 'forest', name: 'Carbon', hex: COLOR_PURPLE, textHex: COLOR_YELLOW, usage: '' },
}

export function getExpandedAccentHex(journeyId: JourneyId): string {
  return EMOTION_ACCENT_HEX[journeyId] ?? GENERAL_ACCENT_HEX
}

export function getJourneyColorVar(journey: JourneyId): string {
  return `var(--color-j-${journey})`
}

export function getJourneyColorHex(journey: JourneyId): string {
  return JOURNEY_COLOR_MAP[journey]?.hex ?? COLOR_PURPLE
}

/** Text on journey card surface */
export function getJourneyCardTextHex(journeyId: JourneyId): string {
  return JOURNEY_COLOR_MAP[journeyId]?.textHex ?? COLOR_YELLOW
}

export function getJourneyCtaBgHex(journeyId: JourneyId): string {
  return EMOTION_CTA_BG_HEX[journeyId] ?? COLOR_YELLOW
}

export function getJourneyCtaTextHex(journeyId: JourneyId): string {
  return EMOTION_CTA_TEXT_HEX[journeyId] ?? COLOR_PURPLE
}

/** Purple system shell — yellow CTAs, purple label */
export function getSystemCtaBgHex(): string {
  return COLOR_YELLOW
}

export function getSystemCtaTextHex(): string {
  return COLOR_PURPLE
}

/** Zone wall + Solo Focus: journey categories = purple; tips + settings = pink. */
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

export function getZoneSurfaceTokens(kind: ZoneSurfaceKind): ZoneSurfaceTokens {
  const isPink = kind === 'tip'
  return {
    bg: isPink ? COLOR_PINK : COLOR_PURPLE,
    text: COLOR_YELLOW,
    ink: COLOR_YELLOW,
    ctaBg: COLOR_YELLOW,
    ctaText: isPink ? COLOR_PINK : COLOR_PURPLE,
    answerBg: COLOR_YELLOW,
    answerText: isPink ? COLOR_PINK : COLOR_PURPLE,
    answerHoverBg: isPink ? COLOR_PINK : COLOR_PURPLE,
    answerHoverText: COLOR_YELLOW,
  }
}

/** Expanded Solo Focus — typographic HUD over Zone atmosphere (no card fill). */
export function zoneExpandedJourneySurfaceStyleProps(): Record<string, string> {
  return {
    '--journey-bg': 'transparent',
    '--journey-text': COLOR_YELLOW,
    '--color-ink': COLOR_YELLOW,
    '--journey-accent': COLOR_PINK,
    '--journey-on-accent': COLOR_YELLOW,
    '--journey-cta-bg': COLOR_PINK,
    '--journey-cta-text': COLOR_YELLOW,
    '--sf-answer-bg': COLOR_YELLOW,
    '--sf-answer-text': COLOR_YELLOW,
    '--sf-answer-hover-bg': COLOR_PINK,
    '--sf-answer-hover-text': COLOR_YELLOW,
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
  general: { grid: COLOR_PURPLE, accent: GENERAL_ACCENT_HEX },
} as const

export const PROFILE_QUESTION_EMOTION_BG: Record<string, string> = {
  name: COLOR_PURPLE,
  postcode: COLOR_PURPLE,
  livingSituation: COLOR_PURPLE,
  homeType: COLOR_PURPLE,
  transport: COLOR_PURPLE,
  age: COLOR_PURPLE,
}
