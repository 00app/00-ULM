/**
 * Card questions (docs/INTELLIGENCE-LOGIC.md §11): the deeper questions a Solo Focus card asks to
 * fill a category's missing facts. Kept apart from LOOP_QUESTION_BANK so loop wording and order
 * stay untouched; the household builder reads these answers through the fact registry's
 * `questionId` (LOOP_TO_FACT), so an answer here fills the fact the rules read.
 *
 * Answer values are the tokens the category rules compare against (`ctx.str(...)` upper-cases),
 * or an ISO date for date facts. A date option stores the middle of its band, so "in the next two
 * months" becomes a date about a month out: close enough for a 60-day rule, and the fact keeps
 * "you told us" as its source. `value: null` is "not sure": we note it as asked and move on.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEYS, getOptionFullLabel } from '@/lib/journeys'
import { getLoopBeatByQuestionId } from '@/lib/zone/loopQuestions'

export type CardQuestionOption = {
  label: string
  /** Token, or null for "not sure". */
  value: string | null
  /** Date facts: days from today for the middle of the band. Overrides `value`. */
  daysFromToday?: number
}

export type CardQuestion = {
  questionId: string
  journeyId: JourneyId
  fieldKey: string
  question: string
  whyWeAsk: string
  options: CardQuestionOption[]
}

const NOT_SURE: CardQuestionOption = { label: 'Not sure', value: null }

export const CARD_QUESTION_BANK: CardQuestion[] = [
  {
    questionId: 'tech_broadband_provider',
    journeyId: 'tech',
    fieldKey: 'broadband_provider',
    question: 'Who is your broadband with?',
    whyWeAsk: 'Prices and exit rules differ by provider.',
    options: [
      { label: 'BT', value: 'BT' },
      { label: 'Sky', value: 'SKY' },
      { label: 'Virgin Media', value: 'VIRGIN MEDIA' },
      { label: 'TalkTalk', value: 'TALKTALK' },
      { label: 'Vodafone', value: 'VODAFONE' },
      { label: 'Someone else', value: 'OTHER' },
    ],
  },
  {
    questionId: 'tech_broadband_end',
    journeyId: 'tech',
    fieldKey: 'broadband_contract_end',
    question: 'When does your broadband contract end?',
    whyWeAsk: 'Out of contract is when prices jump and switching is free.',
    options: [
      { label: 'Already ended', value: 'date', daysFromToday: -30 },
      { label: 'In the next 2 months', value: 'date', daysFromToday: 30 },
      { label: 'In 2 to 6 months', value: 'date', daysFromToday: 120 },
      { label: 'Over 6 months away', value: 'date', daysFromToday: 270 },
      NOT_SURE,
    ],
  },
  {
    questionId: 'tech_mobile_handset',
    journeyId: 'tech',
    fieldKey: 'mobile_handset_paid_off',
    question: 'Is your phone paid off?',
    whyWeAsk: 'Once it is, you can drop to a SIM-only plan.',
    options: [
      { label: 'Yes', value: 'YES' },
      { label: 'No', value: 'NO' },
      NOT_SURE,
    ],
  },
  {
    questionId: 'money_benefits_yes_no',
    journeyId: 'money',
    fieldKey: 'receives_means_tested_benefit',
    question: 'Does anyone at home get a means-tested benefit?',
    whyWeAsk: 'It unlocks social tariffs and grants.',
    options: [
      { label: 'Yes', value: 'YES' },
      { label: 'No', value: 'NO' },
      { label: 'Prefer not to say', value: null },
    ],
  },
  {
    questionId: 'money_benefits_checked',
    journeyId: 'money',
    fieldKey: 'benefits_check_done',
    question: 'Have you run a benefits check in the last year?',
    whyWeAsk: 'If you have, we skip it and go to the next best thing.',
    options: [
      { label: 'Yes', value: 'YES' },
      { label: 'No', value: 'NO' },
      NOT_SURE,
    ],
  },
  {
    questionId: 'money_savings_rate',
    journeyId: 'money',
    fieldKey: 'savings_rate',
    question: 'Do your savings earn less than the Bank of England rate?',
    whyWeAsk: 'Savings below the base rate are losing ground.',
    options: [
      { label: 'Yes, less', value: 'BELOW_BASE' },
      { label: 'No', value: 'AT_OR_ABOVE_BASE' },
      { label: 'No savings', value: 'NO_SAVINGS' },
      NOT_SURE,
    ],
  },
  {
    questionId: 'utilities_fix_end',
    journeyId: 'utilities',
    fieldKey: 'fix_end_date',
    question: 'When does your fixed energy deal end?',
    whyWeAsk: 'You can switch without a fee in the last 49 days.',
    options: [
      { label: 'In the next 7 weeks', value: 'date', daysFromToday: 25 },
      { label: 'In 2 to 6 months', value: 'date', daysFromToday: 120 },
      { label: 'Over 6 months away', value: 'date', daysFromToday: 270 },
      { label: 'I am not on a fix', value: null },
      NOT_SURE,
    ],
  },
  {
    questionId: 'utilities_in_credit',
    journeyId: 'utilities',
    fieldKey: 'account_credit_months',
    question: 'How much credit is on your energy account?',
    whyWeAsk: 'Large credit balances can be refunded to you.',
    options: [
      { label: 'None', value: 'NO' },
      { label: 'About a month', value: 'ABOUT 1 MONTH' },
      { label: '2 months or more', value: '2 OR MORE' },
      NOT_SURE,
    ],
  },
  {
    questionId: 'home_boiler_age',
    journeyId: 'home',
    fieldKey: 'boiler_age_band',
    question: 'How old is your boiler?',
    whyWeAsk: 'Older boilers change which upgrades are worth it.',
    options: [
      { label: 'Under 5 years', value: 'UNDER 5' },
      { label: '5 to 10 years', value: '5 TO 10' },
      { label: '10 to 15 years', value: '10 TO 15' },
      { label: 'Over 15 years', value: 'OVER 15' },
      NOT_SURE,
    ],
  },
  {
    questionId: 'travel_weekly_miles',
    journeyId: 'travel',
    fieldKey: 'weekly_miles',
    question: 'Roughly how many miles do you drive a week?',
    whyWeAsk: 'Low mileage can mean cheaper pay-per-mile cover.',
    options: [
      { label: 'Under 50', value: 'UNDER 50' },
      { label: '50 to 150', value: '50 TO 150' },
      { label: 'Over 150', value: 'OVER 150' },
      { label: 'I do not drive', value: 'NONE' },
    ],
  },
  {
    questionId: 'travel_rail_trips',
    journeyId: 'travel',
    fieldKey: 'rail_trips_per_month',
    question: 'How many train trips do you take a month?',
    whyWeAsk: 'Regular trips can make a railcard pay for itself.',
    options: [
      { label: 'None', value: 'NONE' },
      { label: '1 to 3', value: '1 TO 3' },
      { label: '4 or more', value: '4 OR MORE' },
    ],
  },
  {
    questionId: 'holidays_insurance_type',
    journeyId: 'holidays',
    fieldKey: 'travel_insurance',
    question: 'How do you usually buy travel insurance?',
    whyWeAsk: 'Two or more trips a year often makes annual cover cheaper.',
    options: [
      { label: 'Per trip', value: 'SINGLE' },
      { label: 'Annual policy', value: 'ANNUAL' },
      { label: 'Through my bank account', value: 'BANK' },
      { label: 'I do not', value: 'NONE' },
    ],
  },
  {
    questionId: 'food_weekly_shop',
    journeyId: 'food',
    fieldKey: 'weekly_shop_band',
    question: 'What does your weekly food shop cost?',
    whyWeAsk: 'It sets what a cheaper shop is worth to you.',
    options: [
      { label: 'Under £60', value: 'UNDER £60' },
      { label: '£60 to £100', value: '£60 TO £100' },
      { label: 'Over £100', value: 'OVER £100' },
    ],
  },
  {
    questionId: 'food_supermarket',
    journeyId: 'food',
    fieldKey: 'main_supermarket',
    question: 'Where do you do most of your shopping?',
    whyWeAsk: 'Loyalty prices and own brands differ by shop.',
    options: [
      { label: 'Tesco', value: 'TESCO' },
      { label: 'Sainsbury’s', value: 'SAINSBURYS' },
      { label: 'Asda', value: 'ASDA' },
      { label: 'Aldi or Lidl', value: 'ALDI OR LIDL' },
      { label: 'Somewhere else', value: 'OTHER' },
    ],
  },
  {
    questionId: 'shopping_planned_purchase',
    journeyId: 'shopping',
    fieldKey: 'planned_big_purchase',
    question: 'Planning a big buy in the next few months?',
    whyWeAsk: 'Energy labels and refurbished options change the best pick.',
    options: [
      { label: 'An appliance', value: 'APPLIANCE' },
      { label: 'A phone or laptop', value: 'TECH' },
      { label: 'Nothing planned', value: 'NONE' },
    ],
  },
  {
    questionId: 'solar_battery',
    journeyId: 'solar',
    fieldKey: 'has_battery',
    question: 'Do you have a home battery?',
    whyWeAsk: 'A battery changes how much solar you use yourself.',
    options: [
      { label: 'Yes', value: 'YES' },
      { label: 'No', value: 'NO' },
    ],
  },
  {
    questionId: 'solar_export_tariff',
    journeyId: 'solar',
    fieldKey: 'export_tariff',
    question: 'Are you paid for the solar power you export?',
    whyWeAsk: 'Without an export tariff, spare power earns nothing.',
    options: [
      { label: 'Yes', value: 'YES' },
      { label: 'No', value: 'NONE' },
      NOT_SURE,
    ],
  },
  {
    questionId: 'waste_garden_sub',
    journeyId: 'waste',
    fieldKey: 'garden_waste_subscription',
    question: 'Do you pay for garden waste collection?',
    whyWeAsk: 'Composting at home can replace the subscription.',
    options: [
      { label: 'Yes', value: 'YES' },
      { label: 'No', value: 'NO' },
    ],
  },
]

const BY_ID = new Map(CARD_QUESTION_BANK.map((q) => [q.questionId, q]))

export const CARD_QUESTION_IDS: ReadonlySet<string> = new Set(BY_ID.keys())

export function getCardQuestion(questionId: string): CardQuestion | null {
  return BY_ID.get(questionId) ?? null
}

/** The stored answer for an option: an ISO date for date bands, else its token. */
export function cardOptionAnswer(option: CardQuestionOption, now: Date = new Date()): string | null {
  if (typeof option.daysFromToday === 'number') {
    const d = new Date(now.getTime() + option.daysFromToday * 86_400_000)
    return d.toISOString().slice(0, 10)
  }
  return option.value
}

/**
 * One shape for any gap question Solo Focus can ask: a card question, a loop beat or an
 * onboarding journey question. Null when nothing askable exists for the id.
 */
export type GapQuestion = {
  questionId: string
  kind: 'card' | 'loop' | 'onboarding'
  /** Journey whose answer map stores it (onboarding answers live per journey). */
  journeyId: JourneyId
  question: string
  options: CardQuestionOption[]
}

export function resolveGapQuestion(questionId: string, category: JourneyId): GapQuestion | null {
  const card = getCardQuestion(questionId)
  if (card) {
    return { questionId, kind: 'card', journeyId: card.journeyId, question: card.question, options: card.options }
  }
  const beat = getLoopBeatByQuestionId(questionId)
  if (beat) {
    return {
      questionId,
      kind: 'loop',
      journeyId: beat.journeyKeys[0],
      question: capitalise(beat.question.replace(/\n/g, ' ')),
      options: beat.options.map((o) => ({ label: capitalise(o.ariaLabel ?? o.label), value: o.value })),
    }
  }
  // Onboarding journey question: prefer the card's own category, then any journey that asks it.
  const journeys = [JOURNEYS[category as JourneyId], ...Object.values(JOURNEYS)].filter(Boolean)
  for (const j of journeys) {
    const q = j.questions.find((x) => x.id === questionId)
    if (q && q.type === 'options' && q.options?.length) {
      return {
        questionId,
        kind: 'onboarding',
        journeyId: j.id,
        question: q.label,
        options: q.options.map((o) => ({ label: o === 'UNKNOWN' ? 'Not sure' : getOptionFullLabel(o), value: o === 'UNKNOWN' ? null : o })),
      }
    }
  }
  return null
}

function capitalise(s: string): string {
  const t = s.trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}
