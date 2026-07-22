/**
 * Nine-domain product grid seeds for **every** postcode Firecrawl pass (Hermes / ZeroResearch).
 * Maps loosely to Home, Energy, Water, Waste, Travel, Mobility, Logistics, Food, Shopping, Money.
 * Canonical journey keys remain `JOURNEY_ORDER` (`lib/journeys.ts`).
 */

/** Curated HTTPS seeds — locality row from Postcodes.io still prepended per user in researcher. */
export const NINE_DOMAIN_GRID_SEED_URLS: readonly string[] = [
  'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
  'https://www.moneysavingexpert.com/cheapenergyclub/',
  'https://www.moneysavingexpert.com/utilities/',
  'https://www.gov.uk/government/collections/find-energy-grants-for-you-home-help-to-heat',
  'https://www.gov.uk/improve-energy-efficiency',
  'https://www.gov.uk/energy-company-obligation',
  'https://olioex.com/',
  'https://www.hiyacar.co.uk/',
  'https://www.justpark.com/',
  'https://www.ccwater.org.uk/water-explained/leaks-and-save-water/',
  'https://www.gov.uk/browse/environment-countryside/recycling-rubbish-waste',
  'https://www.gov.uk/guidance/reducing-road-freight-logistics-emissions',
  'https://www.gov.uk/guidance/vehicle-tax-exemption-for-electric-vehicles',
  'https://www.moneysavingexpert.com/shopping/',
]
