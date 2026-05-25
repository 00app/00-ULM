/**
 * When Solo Focus journey answers are cleared (e.g. after `/profile/summary`) but profile
 * fields remain, derive synthetic answers so Zone tiles still show March 2026 £/kg estimates.
 */
import type { JourneyId } from '@/lib/journeys'
import type { ImpactProfile } from '@/lib/brains/types'

/** Loose profile slice — Zone VM uses a wider runtime shape than `ImpactProfile`. */
export type ProfileBaselineInput = Pick<
  ImpactProfile,
  'postcode' | 'home_type' | 'household' | 'transport_baseline' | 'home_power'
>

export function profileHasImpactBaseline(profile?: ProfileBaselineInput): boolean {
  const pc = (profile?.postcode ?? '').replace(/\s+/g, '').trim()
  if (pc.length >= 4) return true
  return Boolean(
    profile?.home_type?.trim() ||
      profile?.household?.trim() ||
      profile?.transport_baseline?.trim() ||
      profile?.home_power?.trim()
  )
}

function normHomePower(profile?: ImpactProfile): string {
  const raw = (profile?.home_power ?? 'GAS').trim().toUpperCase()
  if (raw === 'MIX') return 'MIXED'
  return raw || 'GAS'
}

function normTransport(profile?: ImpactProfile): string {
  return (profile?.transport_baseline ?? 'MIX').trim().toUpperCase() || 'MIX'
}

/** Mid-band synthetic answers aligned to `lib/journeys.ts` question ids. */
export function syntheticJourneyAnswersFromProfile(
  journeyKey: JourneyId,
  profile?: ProfileBaselineInput
): Record<string, string> {
  const homePower = normHomePower(profile)
  const transport = normTransport(profile)
  const homeType = profile?.home_type === 'FLAT' ? 'FLAT' : 'DETACHED'
  const monthly = profile?.household === 'FAMILY' ? '150' : '120'

  switch (journeyKey) {
    case 'home':
      return {
        property_type: homeType,
        insulation_level: 'PARTIAL',
        glazing_type: 'DOUBLE',
        monthly_cost: monthly,
        green_tariff: 'NO',
        energy_type: homePower,
        tariff_type: 'VARIABLE',
      }
    case 'utilities':
      return {
        tariff_type: 'VARIABLE',
        supplier_switch: 'COMPARE',
        monthly_energy_band: '100_TO_200',
        home_power: profile?.home_power ?? 'GAS',
        monthly_cost: monthly,
        green_tariff: 'NO',
      }
    case 'grants':
      return {
        boiler_age: 'OVER_10YR',
        income_benefits: 'NO',
        prior_eco_bus: 'NO',
      }
    case 'solar':
      return {
        roof_orientation: 'SOUTH',
        roof_shading: 'NONE',
        daytime_occupancy: 'MEDIUM',
      }
    case 'travel':
      return {
        commute_distance: transport === 'CAR' ? '22' : '6',
        ev_hybrid: transport === 'CAR' ? 'PETROL_DIESEL' : 'NONE',
        public_transport: transport === 'PUBLIC' ? 'EXCELLENT' : 'LIMITED',
      }
    case 'holidays':
      return {
        annual_flights: 'ONE_TWO',
        flight_duration: 'MEDIUM',
        carbon_offsets: 'NO',
      }
    case 'food':
      return {
        diet_profile: 'FLEXI',
        organic_shopping: 'SOME',
        own_produce: 'NO',
      }
    case 'shopping':
      return {
        retail_channel: 'MIXED',
        repair_mindset: 'MIXED',
        online_deliveries: 'WEEKLY',
        monthly_spend: '180',
        buy_new: 'SOMETIMES',
      }
    case 'money':
      return {
        monthly_energy_bill: monthly,
        tariff_type: 'VARIABLE',
        green_investments: 'SOME',
        finances_tight: 'YES',
      }
    case 'tech':
      return {
        smart_thermostat: 'NO',
        smart_home: 'PARTIAL',
        smart_meter: 'NO',
      }
    case 'water':
      return {
        garden_butt: 'YES',
        wash_preference: 'SHOWER',
        rainwater_harvest: 'NO',
      }
    case 'waste':
      return {
        food_waste_collection: 'YES',
        composting: 'NO',
        soft_plastics: 'SOMETIMES',
      }
    case 'carbon':
      return {
        footprint_awareness: 'SOME',
        carbon_removal: 'NO',
        tonne_reduction_timeline: 'THIS_YEAR',
        tracking: 'NO',
      }
    default:
      return {}
  }
}
