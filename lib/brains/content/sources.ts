/**
 * Map journeys and card types to trusted source URLs
 */

import { JourneyId } from '@/lib/journeys'

export interface CardSource {
  url: string
  label: string
  trusted: boolean
}

/**
 * Get source URL for a journey and card type
 */
export function getSourceForCard(
  journey: JourneyId,
  cardType?: string
): CardSource {
  const sources: Record<JourneyId, CardSource> = {
    home: {
      url: 'https://www.gov.uk/guidance/smart-meters-how-they-work',
      label: 'gov.uk',
      trusted: true,
    },
    travel: {
      url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023',
      label: 'gov.uk',
      trusted: true,
    },
    food: {
      url: 'https://www.energy-saving-trust.org.uk/advice/food-and-drink',
      label: 'energy saving trust',
      trusted: true,
    },
    shopping: {
      url: 'https://www.wrap.org.uk/taking-action/textiles/briefings/circular-economy-textiles',
      label: 'wrap.org.uk',
      trusted: true,
    },
    money: {
      url: 'https://www.moneysavingexpert.com/utilities/',
      label: 'moneysavingexpert.com',
      trusted: true,
    },
    carbon: {
      url: 'https://www.carbonfootprint.com/calculator.aspx',
      label: 'carbonfootprint.com',
      trusted: true,
    },
    tech: {
      url: 'https://www.ifixit.com/sustainability',
      label: 'ifixit.com',
      trusted: true,
    },
    waste: {
      url: 'https://www.recycledevon.org/at-home/composting',
      label: 'recycledevon.org',
      trusted: true,
    },
    holidays: {
      url: 'https://www.theguardian.com/travel/2023/jul/29/staycation-uk-holiday-travel-climate-change',
      label: 'theguardian.com',
      trusted: true,
    },
  }

  return sources[journey] || {
    url: 'https://www.gov.uk',
    label: 'gov.uk',
    trusted: true,
  }
}
