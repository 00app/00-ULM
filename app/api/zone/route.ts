import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// This route is always dynamic (user-specific Zone content)
export const dynamic = 'force-dynamic'

// Constants (LOCKED)
const BAND_VALUE = {
  low: 1,
  medium: 2,
  high: 3,
}

const MIN_FRESHNESS = 0.2
const CARD_DECAY_DAYS = 30
const ZONE_SIZE = 6

// Profile Cards (Phase 1) - Hard-coded
const PROFILE_CARDS = [
  {
    id: 'profile-1',
    title: 'your home footprint.',
    description: 'understanding your home energy use',
    type: 'info',
    impact_band: 'low',
    effort_band: 'low',
    variant: 'card-compact',
  },
  {
    id: 'profile-2',
    title: 'your travel baseline.',
    description: 'how you get around day to day',
    type: 'info',
    impact_band: 'low',
    effort_band: 'low',
    variant: 'card-compact',
  },
  {
    id: 'profile-3',
    title: 'your energy setup.',
    description: 'what powers your home',
    type: 'info',
    impact_band: 'low',
    effort_band: 'low',
    variant: 'card-compact',
  },
  {
    id: 'profile-4',
    title: 'where your money likely goes.',
    description: 'typical spending patterns',
    type: 'info',
    impact_band: 'low',
    effort_band: 'low',
    variant: 'card-compact',
  },
  {
    id: 'profile-5',
    title: 'your biggest opportunity.',
    description: 'where small changes add up',
    type: 'info',
    impact_band: 'low',
    effort_band: 'low',
    variant: 'card-compact',
  },
  {
    id: 'profile-6',
    title: 'where to start first.',
    description: 'begin with one journey',
    type: 'info',
    impact_band: 'low',
    effort_band: 'low',
    variant: 'card-compact',
  },
]

// Score card (NON-HERO)
function scoreCard(card: any, cardView: any, now: number): number {
  const impact = BAND_VALUE[card.impact_band as keyof typeof BAND_VALUE]
  const effort = BAND_VALUE[card.effort_band as keyof typeof BAND_VALUE]

  const daysSince = cardView?.last_shown_at
    ? (now - new Date(cardView.last_shown_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0

  const freshness = Math.max(
    MIN_FRESHNESS,
    1 - daysSince / CARD_DECAY_DAYS
  )

  return (impact * freshness) / effort
}

// Calculate days between dates
function daysBetween(date1: number, date2: number | Date): number {
  const d2 = typeof date2 === 'number' ? date2 : date2.getTime()
  return (date1 - d2) / (1000 * 60 * 60 * 24)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ items: [] })
    }

    const now = Date.now()

    // 1. Get Profile
    const profileResult = await pool.query(
      `SELECT household, home_type, transport_baseline, postcode
       FROM users
       WHERE id = $1`,
      [userId]
    )
    const profile = profileResult.rows[0] || {}

    // 2. Get Journeys
    const journeysResult = await pool.query(
      `SELECT journey_key, state, updated_at as completed_at
       FROM journeys
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    )
    const journeys = journeysResult.rows || []

    // Phase Detection
    const completedJourneys = journeys.filter((j: any) => j.state === 'completed')
    const phase = completedJourneys.length === 0 ? 'PROFILE' : 'JOURNEY'

    // PHASE 1 — PROFILE ZONE
    if (phase === 'PROFILE') {
      return NextResponse.json({
        phase: 'PROFILE',
        items: PROFILE_CARDS.map((card) => ({
          type: 'card',
          id: card.id,
          variant: card.variant,
          data: {
            title: card.title,
            description: card.description,
            type: card.type,
            impact_band: card.impact_band,
            effort_band: card.effort_band,
          },
        })),
        heroId: null,
        savings: null,
        incompleteJourneys: journeys.filter((j: any) => j.state !== 'completed'),
      })
    }

    // PHASE 2 — JOURNEY ZONE

    // STEP 1: Identify Most Recent Journey
    const mostRecentJourney = completedJourneys.sort(
      (a: any, b: any) =>
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    )[0]

    if (!mostRecentJourney) {
      // Fallback to PROFILE if no completed journeys found
      return NextResponse.json({
        phase: 'PROFILE',
        items: PROFILE_CARDS.map((card) => ({
          type: 'card',
          id: card.id,
          variant: card.variant,
          data: {
            title: card.title,
            description: card.description,
            type: card.type,
            impact_band: card.impact_band,
            effort_band: card.effort_band,
          },
        })),
        heroId: null,
        savings: null,
        incompleteJourneys: journeys.filter((j: any) => j.state !== 'completed'),
      })
    }

    // STEP 2: Get Cards for Completed Journeys
    const journeyKeys = completedJourneys.map((j: any) => j.journey_key)
    const placeholders = journeyKeys.map((_: any, i: number) => `$${i + 1}`).join(',')
    const cardsResult = await pool.query(
      `SELECT c.*, cv.last_shown_at, cv.shown_count
       FROM cards c
       LEFT JOIN card_views cv ON cv.card_id = c.id AND cv.user_id = $${journeyKeys.length + 1}
       WHERE c.journey_key IN (${placeholders})
       ORDER BY c.created_at ASC`,
      [...journeyKeys, userId]
    )
    const journeyCards = cardsResult.rows || []

    // STEP 3: Score Cards (NON-HERO - will score after hero selection)
    // Cards are already fetched with card_views

    // STEP 4: Select Hero Card
    const heroCandidates = journeyCards.filter(
      (c: any) =>
        c.journey_key === mostRecentJourney.journey_key && c.type !== 'tip'
    )

    let heroCard: any = null
    if (heroCandidates.length > 0) {
      heroCard = heroCandidates.sort((a: any, b: any) => {
        const aRatio =
          BAND_VALUE[a.impact_band as keyof typeof BAND_VALUE] /
          BAND_VALUE[a.effort_band as keyof typeof BAND_VALUE]
        const bRatio =
          BAND_VALUE[b.impact_band as keyof typeof BAND_VALUE] /
          BAND_VALUE[b.effort_band as keyof typeof BAND_VALUE]
        return bRatio - aRatio
      })[0]
    }

    // STEP 5: Build Remaining Slots
    const remainingCards = journeyCards
      .filter((c: any) => !heroCard || c.id !== heroCard.id)
      .map((card: any) => ({
        ...card,
        score: scoreCard(card, { last_shown_at: card.last_shown_at }, now),
      }))
      .sort((a: any, b: any) => b.score - a.score)

    // STEP 6: Assemble Zone Items
    const zoneItems: any[] = []
    if (heroCard) {
      zoneItems.push({
        type: 'card',
        id: heroCard.id,
        variant: 'card-hero',
        data: {
          ...heroCard,
          journey_key: heroCard.journey_key,
        },
      })
    }

    // Add remaining cards, excluding tips unless needed to fill
    const nonTipCards = remainingCards.filter((c: any) => c.type !== 'tip')
    const tipCards = remainingCards.filter((c: any) => c.type === 'tip')

    zoneItems.push(
      ...nonTipCards.slice(0, ZONE_SIZE - zoneItems.length).map((card: any) => ({
        type: 'card' as const,
        id: card.id,
        variant: (card.type === 'tip' ? 'card-compact' : 'card-standard') as 'card-compact' | 'card-standard',
        data: {
          ...card,
          journey_key: card.journey_key,
        },
      }))
    )

    // Fill with tips only if needed
    if (zoneItems.length < ZONE_SIZE) {
      zoneItems.push(
        ...tipCards.slice(0, ZONE_SIZE - zoneItems.length).map((card: any) => ({
          type: 'card' as const,
          id: card.id,
          variant: 'card-compact' as const,
          data: {
            ...card,
            journey_key: card.journey_key,
          },
        }))
      )
    }

    // Ensure exactly 6
    const finalItems = zoneItems.slice(0, ZONE_SIZE)

    // STEP 7: Calculate Savings Statement
    // Get journey outputs (would come from calculation based on journey_answers)
    // For now, placeholder - would calculate money_delta and carbon_delta from answers
    const journeyOutputsResult = await pool.query(
      `SELECT journey_key, money_delta, carbon_delta
       FROM journeys
       WHERE user_id = $1 AND state = 'completed'`,
      [userId]
    )
    
    // Placeholder: In real implementation, these would be calculated from journey_answers
    const totalMoney = journeyOutputsResult.rows.reduce(
      (sum: number, j: any) => sum + (parseInt(j.money_delta) || 0),
      0
    )
    const totalCarbon = journeyOutputsResult.rows.reduce(
      (sum: number, j: any) => sum + (parseInt(j.carbon_delta) || 0),
      0
    )

    const savings =
      totalMoney > 0 || totalCarbon > 0
        ? { totalMoney, totalCarbon }
        : null

    return NextResponse.json({
      phase: 'JOURNEY',
      items: finalItems,
      heroId: heroCard?.id || null,
      savings,
      incompleteJourneys: journeys.filter((j: any) => j.state !== 'completed'),
    })
  } catch (error) {
    console.error('Error fetching zone:', error)
    return NextResponse.json(
      {
        phase: 'PROFILE',
        items: PROFILE_CARDS.map((card) => ({
          type: 'card',
          id: card.id,
          variant: card.variant,
          data: {
            title: card.title,
            description: card.description,
            type: card.type,
            impact_band: card.impact_band,
            effort_band: card.effort_band,
          },
        })),
        heroId: null,
        savings: null,
        incompleteJourneys: [],
      },
      { status: 500 }
    )
  }
}
