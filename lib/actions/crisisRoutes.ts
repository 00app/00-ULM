/**
 * The crisis routes.
 *
 * Every number here was verified against a live source on 2026-07-31 and every one is a free,
 * national line that doesn't move. Nothing council-specific is hardcoded — local numbers change
 * constantly and a wrong one at the wrong moment does real harm, so those go through the GOV.UK
 * council finder instead.
 *
 * Written deliberately small. Fifteen routes that are right and current beat fifty that rot.
 */

import { CRISIS_ORDER, type CrisisRoute } from '@/lib/actions/crisisTypes'

export const CRISIS_ROUTES: CrisisRoute[] = [
  // --- IMMEDIATE: eat and stay safe this week ---------------------------------------------
  {
    id: 'food-bank-referral',
    action: 'Get a food parcel this week',
    detail:
      'Trussell food banks need a referral, and Citizens Advice can make one the same day. You do not have to be claiming anything to qualify.',
    relief: 'Today or tomorrow',
    askFor: 'Say you need a food bank referral and ask if they can do it on the call.',
    phone: '0800 144 8848',
    hours: 'Mon–Fri, 8am–6pm',
    url: 'https://www.citizensadvice.org.uk/debt-and-money/get-help-with-the-cost-of-living/using-a-food-bank/',
    need: 'ANY',
    order: CRISIS_ORDER.IMMEDIATE,
    source: 'Citizens Advice — food bank referrals; Trussell referral model',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'council-crisis-fund',
    action: 'Ask your council for emergency help',
    detail:
      'Councils hold local welfare and crisis funds for food, fuel and essentials. It is discretionary, separate from benefits, and rarely advertised.',
    relief: 'Days, not weeks',
    askFor: 'Ask for the local welfare assistance or crisis fund — not "a grant".',
    url: 'https://www.gov.uk/find-local-council',
    need: 'ANY',
    // +2 so food and fuel lead this band; ties were resolving alphabetically and put the council
    // fund above a same-week food parcel.
    order: CRISIS_ORDER.IMMEDIATE + 2,
    source: 'GOV.UK find your local council — local welfare assistance is council-administered',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'fuel-vouchers',
    action: 'Get a fuel voucher for a prepayment meter',
    detail:
      'If your meter is running out, the Fuel Bank Foundation issues vouchers through local referral partners. Citizens Advice can point you at the nearest one.',
    relief: 'Same week',
    askFor: 'Say your prepayment meter is about to run out and ask about a fuel voucher.',
    phone: '0800 144 8848',
    hours: 'Mon–Fri, 8am–6pm',
    url: 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/get-help-paying-your-bills/grants-and-benefits-to-help-you-pay-your-energy-bills/',
    need: 'ANY',
    order: CRISIS_ORDER.IMMEDIATE + 1,
    source: 'Citizens Advice — grants and help paying energy bills; Fuel Bank Foundation vouchers',
    verifiedOn: '2026-07-31',
  },

  // --- PROTECT: stop the bleeding ---------------------------------------------------------
  {
    id: 'breathing-space',
    action: 'Ask for Breathing Space',
    detail:
      'A legal 60-day pause. Creditors must stop contacting you and stop enforcement, and interest and charges freeze while you get advice. You can only get it through a debt adviser.',
    relief: '60 days — creditors must stop',
    askFor: 'Ask them to apply for Breathing Space under the Debt Respite Scheme.',
    phone: '0808 808 4000',
    hours: 'Mon–Fri, 9am–8pm; Sat 9.30am–1pm',
    url: 'https://nationaldebtline.org/get-information/guides/breathing-space-ew/',
    need: 'DEBT',
    order: CRISIS_ORDER.PROTECT,
    source: 'National Debtline — Breathing Space (England & Wales), 60 days, applied via approved adviser',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'stepchange-debt-plan',
    action: 'Get a free debt plan',
    detail:
      'StepChange is a charity, not a company. Free, confidential, and they will not sell you anything. Never pay a firm for what they do for nothing.',
    relief: 'One call to start',
    askFor: 'Say you cannot cover essentials and ask for a full debt review.',
    phone: '0800 138 1111',
    hours: 'Mon–Fri, 8am–8pm; Sat 8am–4pm',
    url: 'https://www.stepchange.org/',
    need: 'DEBT',
    order: CRISIS_ORDER.PROTECT,
    source: 'StepChange Debt Charity — free debt advice, 0800 138 1111',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'priority-debts-first',
    action: 'Know which debts come first',
    detail:
      'Rent, council tax, energy and court fines can cost you your home, your supply or your liberty. Credit cards and catalogues cannot. Advisers call these priority debts and they get paid first.',
    relief: 'Changes what you pay today',
    askFor: 'Ask which of your debts are priority debts and what to pay first.',
    phone: '0808 808 4000',
    hours: 'Mon–Fri, 9am–8pm; Sat 9.30am–1pm',
    url: 'https://nationaldebtline.org/get-information/guides/priority-and-non-priority-debts-ew/',
    need: 'DEBT',
    order: CRISIS_ORDER.PROTECT,
    source: 'National Debtline — priority vs non-priority debts (England & Wales)',
    verifiedOn: '2026-07-31',
  },

  // --- INCOME -----------------------------------------------------------------------------
  {
    id: 'help-to-claim',
    action: 'Get help making a Universal Credit claim',
    detail:
      'Free, independent help from Citizens Advice to get a claim started and right first time. They are not the DWP and they are on your side.',
    relief: 'Advance possible in days',
    askFor: 'Ask for Help to Claim, and ask about an advance if you have nothing coming in.',
    phone: '0800 144 8444',
    hours: 'Mon–Fri, 8am–6pm',
    url: 'https://www.citizensadvice.org.uk/benefits/universal-credit/claiming/helptoclaim/',
    need: 'INCOME',
    order: CRISIS_ORDER.INCOME,
    source: 'Citizens Advice Help to Claim — free UC claim support, 0800 144 8444',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'uc-advance-payment',
    action: 'Ask for a Universal Credit advance',
    detail:
      'You do not have to wait five weeks with nothing. An advance is interest-free and repaid from later payments.',
    relief: 'Days, not weeks',
    askFor: 'Say you cannot manage until first payment and ask for an advance.',
    url: 'https://www.gov.uk/universal-credit/get-an-advance-first-payment',
    need: 'INCOME',
    order: CRISIS_ORDER.INCOME,
    source: 'GOV.UK — Universal Credit advance on first payment, interest free',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'challenge-a-benefit-decision',
    action: 'Challenge a benefit refusal',
    detail:
      'A large share of refusals are overturned when challenged. You normally have one month to ask for a mandatory reconsideration, and an adviser can do it with you.',
    relief: 'One month to act',
    askFor: 'Ask for help with a mandatory reconsideration and check the deadline.',
    phone: '0800 144 8848',
    hours: 'Mon–Fri, 8am–6pm',
    url: 'https://www.gov.uk/mandatory-reconsideration',
    need: 'INCOME',
    order: CRISIS_ORDER.INCOME,
    source: 'GOV.UK mandatory reconsideration; Citizens Advice adviceline 0800 144 8848',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'benefits-full-check',
    action: 'Check everything you are owed',
    detail:
      'Around 7 million UK households miss entitlements worth an average £3,428 a year. A full check takes about ten minutes and is free.',
    relief: '£3,428 average missed',
    askFor: 'Have your rent, council tax and any income to hand before you start.',
    url: 'https://benefits-calculator.turn2us.org.uk/',
    need: 'INCOME',
    order: CRISIS_ORDER.INCOME,
    source: 'Policy in Practice, Missing Out 2025 (£24bn unclaimed, ~7m households); Turn2us calculator',
    verifiedOn: '2026-07-31',
  },

  // --- HOUSING ----------------------------------------------------------------------------
  {
    id: 'council-homeless-duty',
    action: 'Tell the council before you lose the home',
    detail:
      'If you could be homeless within 56 days the council has a legal duty to help you prevent it. You do not have to already be out — and leaving it later makes their job harder, not easier.',
    relief: 'They must act at 56 days',
    askFor: 'Say you are threatened with homelessness within 56 days and ask for a prevention duty assessment.',
    url: 'https://www.gov.uk/find-local-council',
    need: 'HOUSING',
    order: CRISIS_ORDER.HOUSING,
    source: 'Homelessness Reduction Act 2017 — prevention duty at 56 days; council contact via GOV.UK finder',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'shelter-helpline',
    action: 'Talk to Shelter about the housing',
    detail:
      'Free expert advice on eviction, arrears, disrepair and homelessness. They know exactly what a council must do and when.',
    relief: 'Free expert advice',
    askFor: 'Tell them where you are in the eviction process and what letters you have had.',
    phone: '0808 800 4444',
    hours: '365 days a year',
    url: 'https://england.shelter.org.uk/get_help',
    need: 'HOUSING',
    order: CRISIS_ORDER.HOUSING,
    source: 'Shelter England — free housing helpline 0808 800 4444',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'discretionary-housing-payment',
    action: 'Ask for a Discretionary Housing Payment',
    detail:
      'Extra council help with rent if your housing benefit or UC housing element does not cover it. Separate pot, you have to ask.',
    relief: 'Covers a rent shortfall',
    askFor: 'Ask to apply for a Discretionary Housing Payment for your rent shortfall.',
    url: 'https://www.gov.uk/government/publications/claiming-discretionary-housing-payments',
    need: 'HOUSING',
    order: CRISIS_ORDER.HOUSING,
    source: 'GOV.UK — Discretionary Housing Payments, administered by councils',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'centrepoint-under-25',
    action: 'Centrepoint, if you are under 25',
    detail:
      'Housing advice built for 16–25s, who have different rights and different routes than everyone else.',
    relief: 'Advice for your age',
    askFor: 'Say your age first — it changes what the council has to do for you.',
    phone: '0808 800 0661',
    hours: 'Mon–Fri, 9am–5pm',
    url: 'https://centrepoint.org.uk/do-you-need-help/i-need-help-now/speak-someone',
    need: 'HOUSING',
    order: CRISIS_ORDER.HOUSING,
    age: ['JUNIOR'],
    source: 'Centrepoint Helpline — 16–25 in England, 0808 800 0661',
    verifiedOn: '2026-07-31',
  },

  // --- SUPPORT ----------------------------------------------------------------------------
  {
    id: 'samaritans',
    action: 'If it is all too much, talk to someone',
    detail:
      'Free, any hour, and it does not show on your phone bill. You do not have to be in crisis to call — money worry alone is reason enough.',
    relief: 'Any hour, any day',
    askFor: 'You do not have to explain or justify anything. Just say it is money and you are struggling.',
    phone: '116 123',
    hours: '24 hours, every day',
    url: 'https://www.samaritans.org/how-we-can-help/contact-samaritan/',
    need: 'ANY',
    order: CRISIS_ORDER.SUPPORT,
    source: 'Samaritans — free 24/7 on 116 123, does not appear on phone bills',
    verifiedOn: '2026-07-31',
  },
]
