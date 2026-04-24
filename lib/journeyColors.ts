/**
 * v1.8.3 — Industrial legibility lock (4 colours only):
 * Yellow cards → purple type; CTAs purple fill + yellow label.
 * Pink cards → yellow type; CTAs yellow fill + pink label.
 * Purple (system/zone) → yellow type; CTAs yellow fill + purple label.
 * Overlays use the same yellow / pink / purple surfaces — no neutral white type.
 */

import type { JourneyId } from '@/lib/journeys'

export const COLOR_YELLOW = '#FDFD00'
export const COLOR_PURPLE = '#7800ce'
export const COLOR_PINK = '#E80DAD'
export const COLOR_SOFT_CREAM = '#7800ce'

export interface JourneyColorEntry {
  journey: JourneyId
  keyword: string
  name: string
  hex: string
  textHex: string
  usage: string
}

/** Card background: yellow or pink only */
export const EMOTION_GRID_HEX: Record<JourneyId, string> = {
  home: COLOR_YELLOW,
  travel: COLOR_PINK,
  food: COLOR_YELLOW,
  shopping: COLOR_PINK,
  money: COLOR_YELLOW,
  carbon: COLOR_PINK,
  tech: COLOR_YELLOW,
  waste: COLOR_PINK,
  holidays: COLOR_YELLOW,
}

/** Body copy on card: yellow surface → purple; pink surface → yellow */
export const EMOTION_TEXT_HEX: Record<JourneyId, string> = {
  home: COLOR_PURPLE,
  travel: COLOR_YELLOW,
  food: COLOR_PURPLE,
  shopping: COLOR_YELLOW,
  money: COLOR_PURPLE,
  carbon: COLOR_YELLOW,
  tech: COLOR_PURPLE,
  waste: COLOR_YELLOW,
  holidays: COLOR_PURPLE,
}

/** CTA fill (contrasts card surface) */
export const EMOTION_CTA_BG_HEX: Record<JourneyId, string> = {
  home: COLOR_PURPLE,
  travel: COLOR_YELLOW,
  food: COLOR_PURPLE,
  shopping: COLOR_YELLOW,
  money: COLOR_PURPLE,
  carbon: COLOR_YELLOW,
  tech: COLOR_PURPLE,
  waste: COLOR_YELLOW,
  holidays: COLOR_PURPLE,
}

/** CTA label on CTA fill */
export const EMOTION_CTA_TEXT_HEX: Record<JourneyId, string> = {
  home: COLOR_YELLOW,
  travel: COLOR_PINK,
  food: COLOR_YELLOW,
  shopping: COLOR_PINK,
  money: COLOR_YELLOW,
  carbon: COLOR_PINK,
  tech: COLOR_YELLOW,
  waste: COLOR_PINK,
  holidays: COLOR_YELLOW,
}

/** @deprecated Use EMOTION_CTA_BG_HEX — kept for callers still on “accent” naming */
export const EMOTION_ACCENT_HEX: Record<JourneyId, string> = {
  home: EMOTION_CTA_BG_HEX.home,
  travel: EMOTION_CTA_BG_HEX.travel,
  food: EMOTION_CTA_BG_HEX.food,
  shopping: EMOTION_CTA_BG_HEX.shopping,
  money: EMOTION_CTA_BG_HEX.money,
  carbon: EMOTION_CTA_BG_HEX.carbon,
  tech: EMOTION_CTA_BG_HEX.tech,
  waste: EMOTION_CTA_BG_HEX.waste,
  holidays: EMOTION_CTA_BG_HEX.holidays,
}

export const HERO_GRID_HEX = COLOR_PURPLE
export const HERO_ACCENT_HEX = COLOR_YELLOW
export const SOFT_CREAM_HEX = COLOR_SOFT_CREAM
export const GENERAL_ACCENT_HEX = COLOR_YELLOW

export const JOURNEY_COLOR_MAP: Record<JourneyId, JourneyColorEntry> = {
  home: { journey: 'home', keyword: 'solar-panels', name: 'Home', hex: COLOR_YELLOW, textHex: COLOR_PURPLE, usage: '' },
  travel: { journey: 'travel', keyword: 'electric-car', name: 'Travel', hex: COLOR_PINK, textHex: COLOR_YELLOW, usage: '' },
  food: { journey: 'food', keyword: 'vegetables', name: 'Food', hex: COLOR_YELLOW, textHex: COLOR_PURPLE, usage: '' },
  shopping: { journey: 'shopping', keyword: 'second-hand-clothing', name: 'Shopping', hex: COLOR_PINK, textHex: COLOR_YELLOW, usage: '' },
  money: { journey: 'money', keyword: 'savings-account', name: 'Money', hex: COLOR_YELLOW, textHex: COLOR_PURPLE, usage: '' },
  carbon: { journey: 'carbon', keyword: 'forest', name: 'Carbon', hex: COLOR_PINK, textHex: COLOR_YELLOW, usage: '' },
  tech: { journey: 'tech', keyword: 'electronics-repair', name: 'Tech', hex: COLOR_YELLOW, textHex: COLOR_PURPLE, usage: '' },
  waste: { journey: 'waste', keyword: 'composting', name: 'Waste', hex: COLOR_PINK, textHex: COLOR_YELLOW, usage: '' },
  holidays: { journey: 'holidays', keyword: 'railway', name: 'Holidays', hex: COLOR_YELLOW, textHex: COLOR_PURPLE, usage: '' },
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
