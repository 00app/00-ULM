import { TRUE_WIN_RAILS } from '@/lib/zone/trueWinRails'
import { trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'

/** Mechanical Zone tip cards when Gemini / Firecrawl are skipped or fail — trusted URLs only. */
export function fallbackZoneTips(postcodeNorm: string | null): unknown[] {
  const locality = postcodeNorm ? ` ${postcodeNorm}` : ''
  const homeUrl = trustedUrlForJourney('home')
  const travelUrl = trustedUrlForJourney('travel')
  const techUrl = trustedUrlForJourney('tech')
  return [
    {
      id: 'inject-fallback-home-cap',
      title: `Price-cap trim${locality}`,
      journey_key: 'home',
      category: 'home',
      data: { money: `£${Math.round(TRUE_WIN_RAILS.energyCapGbp * 0.08)}`, carbon: '140 kg CO₂' },
      source: homeUrl,
      sourceLabel: 'Energy Saving Trust',
      dominant_win: 'money',
      explanation: ['Use official cap context to cut standby and heating drift this month.'],
      actions: { actionType: 'learn', learnUrl: homeUrl },
    },
    {
      id: 'inject-fallback-travel-mode',
      title: 'Commute shift check',
      journey_key: 'travel',
      category: 'travel',
      data: { money: '£180', carbon: '220 kg CO₂' },
      source: travelUrl,
      sourceLabel: 'Energy Saving Trust',
      dominant_win: 'carbon',
      explanation: ['Swap one regular high-cost trip pattern for a lower-emission mode this week.'],
      actions: { actionType: 'learn', learnUrl: travelUrl },
    },
    {
      id: 'inject-fallback-tech-load',
      title: 'Device standby sweep',
      journey_key: 'tech',
      category: 'tech',
      data: { money: '£95', carbon: '95 kg CO₂' },
      source: techUrl,
      sourceLabel: 'Which?',
      dominant_win: 'money',
      explanation: ['Target always-on sockets and chargers to recover cash and avoid phantom draw.'],
      actions: { actionType: 'learn', learnUrl: techUrl },
    },
  ]
}
