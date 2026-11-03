/** All 13 category specs (PRD v4, Z6), in the order the doc builds them: deep first. */

import type { InsightCategory } from '@/lib/zone/insightCard'
import type { CategorySpec } from '@/lib/intelligence/categories/types'
import { tech } from '@/lib/intelligence/categories/tech'
import { utilities } from '@/lib/intelligence/categories/utilities'
import { money } from '@/lib/intelligence/categories/money'
import { lifestyle } from '@/lib/intelligence/categories/lifestyle'
import { home } from '@/lib/intelligence/categories/home'
import { water } from '@/lib/intelligence/categories/water'
import { travel } from '@/lib/intelligence/categories/travel'
import { holidays } from '@/lib/intelligence/categories/holidays'
import { food } from '@/lib/intelligence/categories/food'
import { shopping } from '@/lib/intelligence/categories/shopping'
import { solar } from '@/lib/intelligence/categories/solar'
import { waste } from '@/lib/intelligence/categories/waste'
import { carbon } from '@/lib/intelligence/categories/carbon'

export const CATEGORY_SPECS: Record<InsightCategory, CategorySpec> = {
  tech,
  utilities,
  money,
  lifestyle,
  home,
  water,
  travel,
  holidays,
  food,
  shopping,
  solar,
  waste,
  carbon,
}

export const CATEGORY_SPEC_ORDER: InsightCategory[] = [
  'tech', 'utilities', 'money', 'lifestyle', 'home',
  'water', 'travel', 'holidays', 'food', 'shopping', 'solar', 'waste', 'carbon',
]
