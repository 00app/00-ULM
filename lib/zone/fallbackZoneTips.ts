import { TRUE_WIN_RAILS } from '@/lib/zone/trueWinRails'

/** Mechanical Zone tip cards when Gemini / Firecrawl are skipped or fail. */
export function fallbackZoneTips(postcodeNorm: string | null): unknown[] {
  const locality = postcodeNorm ? ` ${postcodeNorm}` : ''
  const OFGEM_CAP_URL = 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap'
  return [
    {
      id: 'inject-fallback-home-cap',
      title: `Price-cap trim${locality}`,
      journey_key: 'home',
      category: 'home',
      data: { money: `£${Math.round(TRUE_WIN_RAILS.energyCapGbp * 0.08)}`, carbon: '140 kg CO₂' },
      source: OFGEM_CAP_URL,
      sourceLabel: 'Ofgem',
      dominant_win: 'money',
      explanation: ['Use official cap context to cut standby and heating drift this month.'],
      actions: { actionType: 'learn', learnUrl: OFGEM_CAP_URL },
    },
    {
      id: 'inject-fallback-travel-mode',
      title: 'Commute shift check',
      journey_key: 'travel',
      category: 'travel',
      data: { money: '£180', carbon: '220 kg CO₂' },
      source: 'https://www.energysavingtrust.org.uk/advice/transport/',
      sourceLabel: 'Energy Saving Trust',
      dominant_win: 'carbon',
      explanation: ['Swap one regular high-cost trip pattern for a lower-emission mode this week.'],
      actions: { actionType: 'learn', learnUrl: 'https://www.energysavingtrust.org.uk/advice/transport/' },
    },
    {
      id: 'inject-fallback-tech-load',
      title: 'Device standby sweep',
      journey_key: 'tech',
      category: 'tech',
      data: { money: '£95', carbon: '95 kg CO₂' },
      source: 'https://www.which.co.uk/reviews/energy/article/how-to-save-energy-at-home-aHm2V3M2PKwH',
      sourceLabel: 'Which?',
      dominant_win: 'money',
      explanation: ['Target always-on sockets and chargers to recover cash and avoid phantom draw.'],
      actions: {
        actionType: 'learn',
        learnUrl: 'https://www.which.co.uk/reviews/energy/article/how-to-save-energy-at-home-aHm2V3M2PKwH',
      },
    },
  ]
}
