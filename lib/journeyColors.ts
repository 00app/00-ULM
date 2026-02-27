/**
 * 9-Journey Color Matrix — high-chroma journey colors for cards/sheets.
 * Use with ICE or BLUE text for WCAG 2.1 legibility.
 */

import type { JourneyId } from '@/lib/journeys'

export interface JourneyColorEntry {
  journey: JourneyId
  keyword: string
  name: string
  hex: string
  usage: string
}

export const JOURNEY_COLOR_MAP: Record<JourneyId, JourneyColorEntry> = {
  home: {
    journey: 'home',
    keyword: 'solar-panels',
    name: 'Deep Amber',
    hex: '#F5A623',
    usage: 'Energy/Warmth',
  },
  travel: {
    journey: 'travel',
    keyword: 'electric-car',
    name: 'Vibrant Blue',
    hex: '#0096FF',
    usage: 'Movement/Air',
  },
  food: {
    journey: 'food',
    keyword: 'vegetables',
    name: 'Emerald',
    hex: '#00D26A',
    usage: 'Growth/Nature',
  },
  shopping: {
    journey: 'shopping',
    keyword: 'second-hand-clothing',
    name: 'Deep Purple',
    hex: '#7A1FA2',
    usage: 'Retail/Style',
  },
  money: {
    journey: 'money',
    keyword: 'savings-account',
    name: 'Master Deep',
    hex: '#141268',
    usage: 'Stability',
  },
  carbon: {
    journey: 'carbon',
    keyword: 'forest',
    name: 'Master Blue',
    hex: '#000AFF',
    usage: 'Impact',
  },
  tech: {
    journey: 'tech',
    keyword: 'electronics-repair',
    name: 'Deep Cyan',
    hex: '#00B8D4',
    usage: 'Digital/Future',
  },
  waste: {
    journey: 'waste',
    keyword: 'composting',
    name: 'Deep Orange',
    hex: '#E64A19',
    usage: 'Circularity/Soil',
  },
  holidays: {
    journey: 'holidays',
    keyword: 'railway',
    name: 'Vivid Pink',
    hex: '#D81B60',
    usage: 'Leisure',
  },
}

/** CSS variable name for a journey (e.g. 'home' → '--color-j-home') */
export function getJourneyColorVar(journey: JourneyId): string {
  return `var(--color-j-${journey})`
}

/** Hex for a journey (for inline styles when var() not suitable) */
export function getJourneyColorHex(journey: JourneyId): string {
  return JOURNEY_COLOR_MAP[journey]?.hex ?? '#F8F8FE'
}
