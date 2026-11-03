/**
 * Moving Home agent: the knowledge base. Everything someone has to switch, sign up to or update
 * after moving in, grouped by urgency, each with the official place to do it and a source.
 *
 * Mechanical truth: every fact in `why` and every tip was read on its cited page on the
 * `verified` date (browser-checked, 2026-11-03). No prices or estimates live here; live,
 * postcode-specific figures come from lib/entry/firstResult.ts at request time. If a page moves,
 * fix the URL and re-read the claim; never leave a claim without its source.
 *
 * Northern Ireland: most GB-only tasks below are genuinely GB-only, not a coverage gap — NI runs
 * its own system (rates not council tax, DVA not DVLA for driving licences, HSC not NHS England,
 * its own energy market and regulator, its own tenancy deposit schemes). Padding `nations` with
 * `northern-ireland` on a GOV.UK/NHS-England task would show a source that does not apply there,
 * which breaks mechanical truth. Instead each genuinely different NI process gets its own task
 * below, with its own NI source, verified 2026-11-03. The one real gap found on review: V5C
 * vehicle registration is run by DVLA UK-wide (NI's own agency, DVA, only covers driving
 * licences) — that task's `nations` was wrongly GB-only and is fixed in place. `water` stays
 * GB/England+Wales-only deliberately: Scotland and Northern Ireland have no separate domestic
 * water billing to set up (Scottish Water is billed via council tax; NI Water has no domestic
 * charge at all).
 */

export type Nation = 'england' | 'wales' | 'scotland' | 'northern-ireland'

export type MovingTaskGroup = 'first' | 'bills' | 'tell' | 'protect'

/** Who a task is for. Absent = everyone. Shown as a prefix, never used to hide a legal duty. */
export type MovingAudience = 'drivers' | 'renters'

export type MovingSource = { name: string; url: string }

/** `nations` narrows a tip to some nations (absent = wherever its task applies). */
export type MovingTip = { text: string; source: MovingSource; nations?: readonly Nation[] }

export type MovingTask = {
  id: string
  group: MovingTaskGroup
  /** Short imperative. `{council}` is replaced with the live council name when known. */
  title: string
  /** One or two plain sentences: why it matters. Every fact here is on `source`. */
  why: string
  action: { label: string; url: string }
  source: MovingSource
  tips: MovingTip[]
  nations: readonly Nation[]
  audience?: MovingAudience
}

export const MOVING_KNOWLEDGE_VERIFIED = '2026-11-03'

export const MOVING_GROUPS: Record<MovingTaskGroup, { title: string; blurb: string }> = {
  first: { title: 'Do these first', blurb: 'Legal deadlines and fines.' },
  bills: { title: 'Your bills', blurb: 'Energy, water, broadband and post.' },
  tell: { title: 'Tell people', blurb: 'Who needs your new address.' },
  protect: { title: 'Protect and save', blurb: 'Insurance and the help you can get.' },
}

export const MOVING_GROUP_ORDER: readonly MovingTaskGroup[] = ['first', 'bills', 'tell', 'protect']

const GB: readonly Nation[] = ['england', 'wales', 'scotland']
const UK: readonly Nation[] = ['england', 'wales', 'scotland', 'northern-ireland']
const ENGLAND_WALES: readonly Nation[] = ['england', 'wales']
const NI: readonly Nation[] = ['northern-ireland']

const GOVUK = (path: string, name: string): MovingSource => ({ name: `GOV.UK: ${name}`, url: `https://www.gov.uk/${path}` })
const NIDIRECT = (url: string, name = 'nidirect'): MovingSource => ({ name, url })

export const MOVING_TASKS: readonly MovingTask[] = [
  // ── Do these first ──────────────────────────────────────────────────────────────────────
  {
    id: 'council-tax',
    group: 'first',
    title: 'Set up council tax with {council}',
    why: 'Tell your new council you have moved in so the council tax account is in your name.',
    action: { label: 'Find your council', url: 'https://www.gov.uk/find-local-council' },
    source: GOVUK('find-local-council', 'Find your local council'),
    tips: [
      {
        text: 'Live on your own? You get 25% off your bill if no other adult in the home counts for council tax.',
        source: GOVUK('council-tax/who-has-to-pay', 'Council Tax, who has to pay'),
      },
      {
        text: 'Check the band for your new home, and challenge it if you think it is wrong.',
        source: GOVUK('council-tax-bands', 'Check your Council Tax band'),
        nations: ENGLAND_WALES,
      },
      {
        text: 'In Scotland, look up the band on the Scottish Assessors website.',
        source: { name: 'Scottish Assessors', url: 'https://www.saa.gov.uk/' },
        nations: ['scotland'],
      },
    ],
    nations: GB,
  },
  {
    id: 'rates-ni',
    group: 'first',
    title: 'Update your rates account with Land & Property Services',
    why: 'Northern Ireland does not have council tax. Domestic rates are billed by Land & Property Services (LPS), and you need to tell them you have moved in.',
    action: {
      label: 'Create or update your rate account',
      url: 'https://www.nidirect.gov.uk/services/create-or-update-your-rate-account',
    },
    source: NIDIRECT('https://www.nidirect.gov.uk/articles/make-changes-your-rate-account'),
    tips: [],
    nations: NI,
  },
  {
    id: 'dvla-licence',
    group: 'first',
    title: 'Change the address on your driving licence',
    why: 'You can be fined up to £1,000 if you do not tell DVLA when your address changes.',
    action: { label: 'Update with DVLA', url: 'https://www.gov.uk/change-address-driving-licence' },
    source: GOVUK('change-address-driving-licence', 'Change the address on your driving licence'),
    tips: [],
    nations: GB,
    audience: 'drivers',
  },
  {
    id: 'dvla-licence-ni',
    group: 'first',
    title: 'Change the address on your driving licence (NI)',
    why: 'Driving licences in Northern Ireland are issued by the DVA, not DVLA. Change your address with them while you are still resident there.',
    action: {
      label: 'Change your address with DVA',
      url: 'https://www.nidirect.gov.uk/services/change-your-address-your-driving-licence-online',
    },
    source: NIDIRECT('https://www.nidirect.gov.uk/services/change-your-address-your-driving-licence-online'),
    tips: [],
    nations: NI,
    audience: 'drivers',
  },
  {
    id: 'dvla-v5c',
    group: 'first',
    title: 'Change the address on your vehicle log book (V5C)',
    why: 'The same rule applies to your log book: up to £1,000 fine if DVLA is not told. DVLA registers vehicles across the whole UK, including Northern Ireland, even though NI driving licences are handled separately by the DVA.',
    action: { label: 'Update your V5C', url: 'https://www.gov.uk/change-address-v5c' },
    source: GOVUK('change-address-v5c', 'Change your address on your vehicle log book (V5C)'),
    tips: [],
    nations: UK,
    audience: 'drivers',
  },
  {
    id: 'tv-licence',
    group: 'first',
    title: 'Move your TV Licence',
    why: 'You need to change the address on your licence when you move. You can do it up to three months before.',
    action: {
      label: 'Change your address',
      url: 'https://www.tvlicensing.co.uk/check-if-you-need-one/for-your-home/youre-moving-address-aud23',
    },
    source: {
      name: 'TV Licensing',
      url: 'https://www.tvlicensing.co.uk/check-if-you-need-one/for-your-home/youre-moving-address-aud23',
    },
    tips: [],
    nations: UK,
  },
  {
    id: 'deposit',
    group: 'first',
    title: 'Check your deposit is protected',
    why: 'Your landlord or letting agent must put your deposit in a government-backed scheme within 30 days of getting it.',
    action: { label: 'How protection works', url: 'https://www.gov.uk/tenancy-deposit-protection' },
    source: GOVUK('tenancy-deposit-protection', 'Tenancy deposit protection'),
    tips: [],
    nations: ENGLAND_WALES,
    audience: 'renters',
  },
  {
    id: 'deposit-ni',
    group: 'first',
    title: 'Check your deposit is protected',
    why: "In Northern Ireland your landlord cannot ask for more than one month's rent as a deposit, and must protect it in an approved NI scheme within 28 days of getting it.",
    action: {
      label: 'How protection works',
      url: 'https://nidirect.gov.uk/articles/tenancy-deposit-scheme-information-tenants',
    },
    source: NIDIRECT('https://nidirect.gov.uk/articles/tenancy-deposit-scheme-information-tenants'),
    tips: [],
    nations: NI,
    audience: 'renters',
  },

  // ── Your bills ─────────────────────────────────────────────────────────────────────────
  {
    id: 'energy',
    group: 'bills',
    title: 'Read the meters and tell the energy supplier',
    why: 'When you move in you are put on the current supplier’s standard variable tariff (a “deemed contract”). Read the meters on the day you move in and give them the readings.',
    action: {
      label: 'Moving home and energy',
      url: 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/moving-home-your-energy-supply/moving-home-dealing-with-your-energy-supply/',
    },
    source: {
      name: 'Citizens Advice',
      url: 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/moving-home-your-energy-supply/moving-home-dealing-with-your-energy-supply/',
    },
    tips: [
      {
        text: 'Once you are responsible for the home you can switch tariff or supplier.',
        source: {
          name: 'Citizens Advice',
          url: 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/moving-home-your-energy-supply/moving-home-dealing-with-your-energy-supply/',
        },
      },
      {
        text: 'Not sure who supplies the gas? Look it up with Find My Supplier.',
        source: { name: 'Find My Supplier', url: 'https://www.findmysupplier.energy/' },
      },
    ],
    nations: GB,
  },
  {
    id: 'energy-ni',
    group: 'bills',
    title: 'Check your energy supplier and tariff',
    why: 'Northern Ireland has its own energy market, separate from Great Britain, with its own suppliers and regulator. Check which suppliers cover your new home and compare tariffs.',
    action: {
      label: 'Switching electricity or gas supplier',
      url: 'https://www.consumercouncil.org.uk/consumers/help-consumers/electricity-oil-and-gas/switching-electricity-or-gas-supplier',
    },
    source: {
      name: 'Consumer Council for Northern Ireland',
      url: 'https://www.consumercouncil.org.uk/consumers/help-consumers/electricity-oil-and-gas/switching-electricity-or-gas-supplier',
    },
    tips: [],
    nations: NI,
  },
  {
    id: 'water',
    group: 'bills',
    title: 'Tell your water company you have moved in',
    why: 'Your water and wastewater company depends on your postcode. Look it up and set up your account.',
    action: { label: 'Find your water company', url: 'https://www.water.org.uk/customers/find-your-supplier' },
    source: { name: 'Water UK', url: 'https://www.water.org.uk/customers/find-your-supplier' },
    tips: [
      {
        text: 'A water meter could cut your bill. Try CCW’s calculator before you decide.',
        source: { name: 'CCW', url: 'https://www.ccw.org.uk/save-money-and-water/water-meter-calculator/' },
      },
      {
        text: 'Every water company has a social tariff that can reduce bills on a low income.',
        source: { name: 'CCW', url: 'https://www.ccw.org.uk/save-money-and-water/help-with-bills/' },
      },
    ],
    nations: ENGLAND_WALES,
  },
  {
    id: 'broadband',
    group: 'bills',
    title: 'Get broadband and mobile sorted',
    why: 'See which broadband and mobile services reach your new home before you choose a provider.',
    action: { label: 'Check coverage', url: 'https://checker.ofcom.org.uk/' },
    source: { name: 'Ofcom', url: 'https://checker.ofcom.org.uk/' },
    tips: [
      {
        text: 'Ofcom lists cheaper social tariff broadband and phone packages, and who can get them.',
        source: { name: 'Ofcom', url: 'https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs' },
      },
    ],
    nations: UK,
  },
  {
    id: 'post',
    group: 'bills',
    title: 'Redirect your post',
    why: 'Royal Mail can redirect your post to any UK address while you update everyone.',
    action: { label: 'Redirect your mail', url: 'https://www.royalmail.com/personal/receiving-mail/redirection' },
    source: { name: 'Royal Mail', url: 'https://www.royalmail.com/personal/receiving-mail/redirection' },
    tips: [],
    nations: UK,
  },

  // ── Tell people ────────────────────────────────────────────────────────────────────────
  {
    id: 'vote',
    group: 'tell',
    title: 'Register to vote at your new address',
    why: 'To update your address on the electoral register, you register again with your new details.',
    action: { label: 'Register to vote', url: 'https://www.gov.uk/register-to-vote' },
    source: GOVUK('register-to-vote', 'Register to vote'),
    tips: [],
    nations: UK,
  },
  {
    id: 'gp',
    group: 'tell',
    title: 'Register with a GP near your new home',
    why: 'Find a GP surgery that covers your new address and register with it.',
    action: {
      label: 'Register with a GP',
      url: 'https://www.nhs.uk/nhs-services/gps/how-to-register-with-a-gp-surgery/',
    },
    source: { name: 'NHS', url: 'https://www.nhs.uk/nhs-services/gps/how-to-register-with-a-gp-surgery/' },
    tips: [],
    nations: ['england'],
  },
  {
    id: 'gp-ni',
    group: 'tell',
    title: 'Register with a GP near your new home',
    why: 'Find a GP practice that covers your new address, check it is taking new patients, then register. You no longer need a reason to pick which doctor in the practice you see.',
    action: { label: 'Find a GP practice', url: 'https://www.nidirect.gov.uk/services/gp-practices' },
    source: NIDIRECT('https://www.nidirect.gov.uk/articles/your-local-doctor-gp'),
    tips: [],
    nations: NI,
  },
  {
    id: 'hmrc',
    group: 'tell',
    title: 'Tell HMRC your new address',
    why: 'HMRC asks you to tell them when you change your address.',
    action: { label: 'Update HMRC', url: 'https://www.gov.uk/tell-hmrc-change-address' },
    source: GOVUK('tell-hmrc-change-address', 'Tell HMRC when you change your address'),
    tips: [],
    nations: UK,
  },
  {
    id: 'benefits',
    group: 'tell',
    title: 'If you get benefits, report the move',
    why: 'Tell the office that pays your benefit about changes in your circumstances. Check which ones apply to you.',
    action: { label: 'Report a change', url: 'https://www.gov.uk/report-benefits-change-circumstances' },
    source: GOVUK('report-benefits-change-circumstances', 'Benefits: report a change in your circumstances'),
    tips: [],
    nations: GB,
  },
  {
    id: 'benefits-ni',
    group: 'tell',
    title: 'If you get benefits, report the move',
    why: 'Who you tell depends on which benefit you get: Universal Credit through your online account, Housing Benefit through the Housing Executive, State Pension through the NI Pension Centre, and so on.',
    action: { label: 'Report a change', url: 'https://nidirect.gov.uk/articles/get-in-touch-if-your-circumstances-change' },
    source: NIDIRECT('https://nidirect.gov.uk/articles/get-in-touch-if-your-circumstances-change'),
    tips: [],
    nations: NI,
  },

  // ── Protect and save ───────────────────────────────────────────────────────────────────
  {
    id: 'home-insurance',
    group: 'protect',
    title: 'Insure your new home',
    why: 'With a mortgage you are normally required to have buildings insurance. Renters only need contents insurance.',
    action: {
      label: 'How to pick cover',
      url: 'https://www.moneyhelper.org.uk/en/everyday-money/insurance/home-insurance-how-to-get-the-best-deal',
    },
    source: {
      name: 'MoneyHelper',
      url: 'https://www.moneyhelper.org.uk/en/everyday-money/insurance/home-insurance-how-to-get-the-best-deal',
    },
    tips: [
      {
        text: 'If your mortgage lender offers buildings cover, ask for a breakdown and compare it with a standalone quote.',
        source: {
          name: 'MoneyHelper',
          url: 'https://www.moneyhelper.org.uk/en/everyday-money/insurance/home-insurance-how-to-get-the-best-deal',
        },
      },
    ],
    nations: UK,
  },
  {
    id: 'car-insurance',
    group: 'protect',
    title: 'Tell your car insurer you have moved',
    why: 'A change of address is something you must tell your insurer. If you do not, your policy might not be valid.',
    action: {
      label: 'What to tell your insurer',
      url: 'https://www.moneyhelper.org.uk/en/everyday-money/insurance/car-insurance-what-you-need-to-know',
    },
    source: {
      name: 'MoneyHelper',
      url: 'https://www.moneyhelper.org.uk/en/everyday-money/insurance/car-insurance-what-you-need-to-know',
    },
    tips: [],
    nations: UK,
    audience: 'drivers',
  },
  {
    id: 'help',
    group: 'protect',
    title: 'Check what help you can get',
    why: 'A new home is a good moment to check which benefits and discounts you are entitled to.',
    action: { label: 'Benefits calculators', url: 'https://www.gov.uk/benefits-calculators' },
    source: GOVUK('benefits-calculators', 'Benefits calculators'),
    tips: [],
    nations: GB,
  },
  {
    id: 'help-ni',
    group: 'protect',
    title: 'Check what help you can get',
    why: 'A new home is a good moment to check which benefits and discounts you are entitled to.',
    action: { label: 'Benefits calculator', url: 'https://www.nidirect.gov.uk/benefits-adviser' },
    source: NIDIRECT('https://www.nidirect.gov.uk/benefits-adviser'),
    tips: [],
    nations: NI,
  },
]

export const MOVING_AUDIENCE_PREFIX: Record<MovingAudience, string> = {
  drivers: 'If you drive',
  renters: 'If you rent',
}

/** postcodes.io `country` → Nation (null when unknown, which shows every task). */
export function nationFromCountry(country: string | null | undefined): Nation | null {
  const c = String(country ?? '').trim().toLowerCase()
  if (c === 'england') return 'england'
  if (c === 'wales') return 'wales'
  if (c === 'scotland') return 'scotland'
  if (c === 'northern ireland') return 'northern-ireland'
  return null
}

/** Tasks for a nation (all of them when the nation is unknown), in group then list order. */
export function movingTasksFor(nation: Nation | null): MovingTask[] {
  const tasks = nation ? MOVING_TASKS.filter((t) => t.nations.includes(nation)) : [...MOVING_TASKS]
  return MOVING_GROUP_ORDER.flatMap((g) => tasks.filter((t) => t.group === g))
}

/** A task's tips for a nation (all tips when the nation is unknown). */
export function tipsFor(task: MovingTask, nation: Nation | null): MovingTip[] {
  return nation ? task.tips.filter((t) => !t.nations || t.nations.includes(nation)) : task.tips
}

export function resolveTaskTitle(task: MovingTask, council: string | null | undefined): string {
  const name = council?.trim()
  return task.title.replace('{council}', name || 'your new council').replace(/\s+/g, ' ')
}
