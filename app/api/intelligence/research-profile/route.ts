import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { buildResearchProfilePayload } from '@/lib/profile/buildResearchProfilePayload'
import {
  enrichResearchProfileFromSession,
  readPropertyIntelligenceFromGenome,
} from '@/lib/intelligence/enrichProfileDataFromGenome'
import { buildAnswerFunnelFromResearchProfile } from '@/lib/intelligence/enrichProfileDataFromGenome'
import { inferHouseholdIncomeBracket } from '@/lib/profile/inferHouseholdIncomeBracket'

export const dynamic = 'force-dynamic'

/** Server-side enriched research profile for scrape-sync / handshake (genome + inferred income). */
export async function GET() {
  try {
    const session = await getSessionFromRequest().catch(() => null)
    if (!session?.userId) {
      return NextResponse.json({ profile: null, priorityJourneys: [] })
    }

    const result = await pool.query(
      `SELECT postcode, household, home_type, transport_baseline, age_group, employment_status, user_genome
       FROM users WHERE id = $1`,
      [session.userId]
    )
    const row = result.rows?.[0]
    if (!row) {
      return NextResponse.json({ profile: null, priorityJourneys: [] })
    }

    const genome =
      row.user_genome && typeof row.user_genome === 'object' && !Array.isArray(row.user_genome)
        ? (row.user_genome as Record<string, unknown>)
        : {}
    const pi = readPropertyIntelligenceFromGenome(genome)
    const goalRaw =
      typeof genome.profile_goal === 'string'
        ? genome.profile_goal
        : typeof genome.primary_goal === 'string'
          ? genome.primary_goal
          : null
    const homePower =
      typeof genome.home_power === 'string' ? genome.home_power : null
    const houseNumber =
      typeof genome.house_number === 'string' ? genome.house_number : null
    const storedIncome =
      typeof genome.household_income_bracket === 'string'
        ? genome.household_income_bracket
        : null

    const inferredIncome =
      storedIncome ??
      inferHouseholdIncomeBracket({
        employment_status: row.employment_status,
        age_group: row.age_group,
        postcode: row.postcode,
        imd_decile: pi?.deprivation?.imdDecile,
        property_value_band: pi?.landRegistry?.propertyValueBand,
        household_income_bracket: storedIncome,
      })

    const base = buildResearchProfilePayload(
      {
        postcode: row.postcode,
        livingSituation: row.household,
        homeType: row.home_type,
        transport: row.transport_baseline,
        age: row.age_group,
        employmentStatus: row.employment_status,
        powerType: homePower ?? undefined,
        houseNumber: houseNumber ?? undefined,
        goal: goalRaw ?? undefined,
        household_income_bracket: inferredIncome ?? undefined,
      },
      { postcode: row.postcode }
    )

    const profile = enrichResearchProfileFromSession(base, { user_genome: genome })
    const funnel = buildAnswerFunnelFromResearchProfile(profile, {
      propertyIntelligence: pi,
      genome,
    })

    return NextResponse.json({
      profile,
      propertyIntelligence: pi,
      priorityJourneys: funnel.priorityJourneys,
      toneMode: funnel.toneMode,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'research-profile failed'
    console.error('[api/intelligence/research-profile]', message)
    return NextResponse.json({ profile: null, priorityJourneys: [], error: message }, { status: 500 })
  }
}
