/**
 * Real heat-pump/heating-support scheme for THIS user — country and tenure aware.
 *
 * Before this, every "gas heating" discovery card pointed everyone at the Boiler Upgrade Scheme
 * (England & Wales, owner-occupier oriented) regardless of whether the user was in Scotland,
 * Northern Ireland, or renting. All four URLs below were individually verified live (fetched and
 * read) during the 2026-07-22 link audit — see that session's findings for the Warm Home Discount
 * page, which is where the NI Direct Affordable Warmth URL was itself sourced from (gov.uk's own
 * "not available in Northern Ireland" pointer).
 */

import { ukCountryFromPostcode } from '@/lib/zone/ukCountryFromPostcode'

export type HomeHeatingSchemeContent = {
  headline: string
  body: string
  learnUrl: string
  ctaLabel: string
  ctaUrl: string
}

function isRenterTenure(tenure: string | null | undefined): boolean {
  return (tenure ?? '').toUpperCase().includes('RENT')
}

export function homeHeatingSchemeForUser(params: {
  postcode?: string | null
  tenure?: string | null
}): HomeHeatingSchemeContent {
  const country = ukCountryFromPostcode(params.postcode)
  const renter = isRenterTenure(params.tenure)

  if (country === 'scotland') {
    return {
      headline: 'HEAT PUMP SUPPORT — SCOTLAND',
      body: 'Home Energy Scotland offers a grant and interest-free loan for heat pumps, with extra rural uplift support for island and remote postcodes — this runs instead of the England & Wales scheme.',
      learnUrl: 'https://www.homeenergyscotland.org/find-funding',
      ctaLabel: 'Check funding',
      ctaUrl: 'https://www.homeenergyscotland.org/find-funding',
    }
  }

  if (country === 'northern-ireland') {
    return {
      headline: 'AFFORDABLE WARMTH — NI',
      body: 'The Boiler Upgrade Scheme and Warm Home Discount do not run in Northern Ireland — the Affordable Warmth Scheme is the equivalent support for eligible households here.',
      learnUrl: 'https://www.nihe.gov.uk/Housing-Help/Affordable-Warmth-Boiler-Replacement/Affordable-Warmth-Scheme',
      ctaLabel: 'Check eligibility',
      ctaUrl: 'https://www.nihe.gov.uk/Housing-Help/Affordable-Warmth-Boiler-Replacement/Affordable-Warmth-Scheme',
    }
  }

  if (renter) {
    return {
      headline: 'GRANTS FOR RENTERS TOO',
      body: 'The Boiler Upgrade Scheme grant is paid to property owners, but renters can still qualify for help through income-based schemes like the Warm Homes: Local Grant — any install still needs your landlord on board.',
      learnUrl: 'https://www.gov.uk/government/collections/find-energy-grants-for-you-home-help-to-heat',
      ctaLabel: 'Find your scheme',
      ctaUrl: 'https://www.gov.uk/government/collections/find-energy-grants-for-you-home-help-to-heat',
    }
  }

  return {
    headline: 'HEAT PUMP UPGRADE',
    body: 'Gas-heated homes can access official heat pump support up to £7,500 where rules apply — insulation quality still changes what installers quote.',
    learnUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
    ctaLabel: 'Check eligibility',
    ctaUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
  }
}
