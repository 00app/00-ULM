/**
 * Front door copy and figures. Every figure carries its source and date (mechanical truth).
 * When facts.json lands (PRD v3, runbook prompt 3), read FACTS from it instead.
 */

export type Fact = {
  id: string
  prefix?: string
  value: number
  suffix?: string
  label: string
  source: string
  date: string
  url: string
}

export const FACTS: Fact[] = [
  {
    id: 'price-cap',
    prefix: '£',
    value: 1723,
    label: 'Typical yearly gas and electricity bill under the price cap, up £60 (4%) from 1 October.',
    source: 'Ofgem',
    date: '26 Aug 2026',
    url: 'https://ofgem.gov.uk/press-release/energy-price-cap-will-rise-4-october-2026',
  },
  {
    id: 'out-of-contract',
    prefix: '£',
    value: 108,
    label: 'A year: the average extra paid for broadband, landline and TV once out of contract (£78 vs £69 a month).',
    source: 'Ofcom via TelecomLead',
    date: '2026',
    url: 'https://telecomlead.com/broadband/ofcom-3-43-million-uk-users-switch-broadband-and-landline-as-out-of-contract-customers-face-108-annual-premium-127844',
  },
  {
    id: 'streaming',
    value: 34,
    suffix: '%',
    label: 'Of streaming households pay for at least one service they rarely or never use.',
    source: 'Uswitch survey, 1,000 adults',
    date: 'Jul 2026',
    url: 'https://www.advanced-television.com/2026/07/27/survey-56-say-rising-streaming-costs-hard-to-justify/',
  },
  {
    id: 'heat-pump',
    prefix: '£',
    value: 9000,
    label: 'Heat pump grant for oil and LPG homes in England and Wales until 31 March 2027. £7,500 for others.',
    source: 'Energy Saving Trust',
    date: 'Jul 2026',
    url: 'https://www.energysavingtrust.org.uk/grants-and-schemes/boiler-upgrade-scheme/',
  },
]

export const WINS = [
  {
    n: '001',
    effort: 'No cost',
    title: 'Four-minute showers',
    body: 'Set a timer or play one song. Turning the water temperature down saves a further £40.',
    saving: '£45 a year',
    source: 'Energy Saving Trust',
    url: 'https://energysavingtrust.org.uk/energysaversweek',
  },
  {
    n: '002',
    effort: '10 minutes',
    title: 'Check your contract end dates',
    body: 'Broadband, mobile, energy and insurance. Once a bundle is out of contract it costs £9 a month more on average.',
    saving: '£108 a year',
    source: 'Ofcom via TelecomLead',
    url: 'https://telecomlead.com/broadband/ofcom-3-43-million-uk-users-switch-broadband-and-landline-as-out-of-contract-customers-face-108-annual-premium-127844',
  },
  {
    n: '003',
    effort: '15 minutes',
    title: 'Check the heat pump grant',
    body: 'Homeowners in England and Wales replacing a boiler. Oil and LPG homes get more until 31 March 2027.',
    saving: 'Up to £9,000',
    source: 'Energy Saving Trust',
    url: 'https://www.energysavingtrust.org.uk/grants-and-schemes/boiler-upgrade-scheme/',
  },
]

export const STEPS = [
  {
    n: '01',
    title: 'Find',
    body: 'Add your postcode or a bill. We look for out-of-contract deals, unused subscriptions and grants you may qualify for.',
  },
  {
    n: '02',
    title: 'Explain',
    body: 'Every number opens to show what drives it, where it came from and how sure we are.',
  },
  {
    n: '03',
    title: 'Act',
    body: 'We prepare the switch, letter or claim. Nothing happens until you approve it.',
  },
]

export const RULES = [
  { n: '01', title: 'No number without a source', body: 'Every £ and kg shows where it came from and when. Missing stays missing.' },
  { n: '02', title: 'Ranked by your saving', body: 'Offers are ordered by what you save, never by what we earn.' },
  { n: '03', title: 'Commission disclosed', body: 'When we earn from a switch, the card says so.' },
  { n: '04', title: 'You approve everything', body: 'Nothing is switched, cancelled or shared without your tap.' },
]

export const FAQS = [
  { q: 'Is it free?', a: 'Yes. Zero Zero Workspace is free to use.' },
  {
    q: 'How do you make money?',
    a: 'Some switches earn us a commission from the provider. We rank by your saving, not our commission, and the card says when we earn.',
  },
  {
    q: 'Do you need my bank login?',
    a: 'No. Start with your postcode or a bill. Connecting a bank account will be optional, through a regulated provider.',
  },
  {
    q: 'Where do your figures come from?',
    a: 'Regulators and published sources such as Ofgem, Ofcom and the Energy Saving Trust. Each figure links to its source and shows its date.',
  },
]
