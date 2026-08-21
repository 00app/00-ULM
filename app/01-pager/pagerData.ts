/**
 * The one-pager, as data.
 *
 * Every box follows one rule: the FRONT is the claim, the BACK is the proof. That is deliberate
 * and it is not decoration. Zero Zero's whole argument is that it never asserts a number without
 * a source, so the page that pitches it should behave the same way. Someone tapping a card to
 * check where £24bn came from is not reading about the product, they are using it.
 *
 * Consequence of that rule: nothing goes on this page without a `source`. If a claim cannot be
 * backed, it does not belong here, however good it would look.
 *
 * House style, matching the app: no em dashes, British spelling, Marvin for the big type.
 */

export type PagerCard = {
  id: string
  /** Small label above the number. */
  eyebrow: string
  /** The big Marvin figure. Kept short so it stays legible at display size. */
  figure: string
  /** One line under the figure. */
  line: string
  /** The proof. Shown when the card is opened. */
  back: string
  /** Where the claim comes from. Every card has one, without exception. */
  source: string
  /** Bento span. Wide is two thirds of the row; everything else is a third. */
  span?: 'wide'
  /** The app's 3-colour lock. No fourth tone: see globals.css, "3-colour lock · 60px radius". */
  tone?: 'yellow' | 'deep' | 'pink'
}

/**
 * Verified 31 July 2026. Re-check quarterly, same discipline as the action library.
 *
 * Order is load-bearing twice over. Narratively it runs problem, scale, cause, product, proof,
 * crisis, market, founder, honest status. Structurally it tiles a six-column grid with no gaps:
 * 4+2 / 2+2+2 / 4+2 / 4+2. Reordering these will punch a hole in the layout, so if you move one,
 * move a partner with it.
 */
export const PAGER_CARDS: PagerCard[] = [
  {
    id: 'unclaimed',
    eyebrow: 'Unclaimed every year',
    figure: '£24bn',
    line: 'Support that people qualify for and never receive.',
    back: 'Around 7 million households are missing entitlements they are already eligible for. Universal Credit alone accounts for £11.1bn of it, council tax support £3.3bn, carer\'s allowance £2.4bn. The figure rose £2.7bn in a single year.',
    source: 'Policy in Practice, Missing Out 2025',
    span: 'wide',
    tone: 'yellow',
  },
  {
    id: 'per-household',
    eyebrow: 'Missed per household',
    figure: '£3,428',
    line: 'A year. For seven million homes.',
    back: 'That is not a rounding error in someone\'s budget. For a household on the edge it is the difference between managing and not. Most never find out they were owed it.',
    source: 'Policy in Practice, Missing Out 2025',
    tone: 'deep',
  },
  {
    id: 'information',
    eyebrow: 'The actual problem',
    figure: 'UNSEEN',
    line: 'People qualify. They just do not know it exists.',
    back: 'Only 8.6% of the 6.2 million UK households eligible for a social broadband tariff have one, and 55% of benefit recipients have never heard of it. That is a £200 a year saving sitting behind nothing but a lack of information.',
    source: 'Ofcom social tariffs, February 2026',
    tone: 'pink',
  },
  {
    id: 'actions',
    eyebrow: 'Actions in the library',
    figure: '63',
    line: 'Ranked by what you qualify for and what you can afford.',
    back: 'Each one is a real scheme with a cited source and a form to fill in, never an article to read. Someone who says money is tight is never shown a £2,000 purchase, because a paid recommendation burns a slot a claimable entitlement could have used.',
    source: 'lib/actions/actionLibrary.ts, verified 31 July 2026',
    tone: 'deep',
  },
  {
    id: 'assertions',
    eyebrow: 'Automated build checks',
    figure: '546',
    line: 'The app cannot ship a claim it has not earned.',
    back: 'A renter is never shown loft insulation. An entitlement is never asserted for someone we did not ask about. Deterministic, not generative: same profile in, same result out, every card auditable to a citation. No model inventing benefits.',
    source: 'npm run verify, 31 July 2026',
    tone: 'pink',
  },
  {
    id: 'crisis',
    eyebrow: 'Crisis routes to human help',
    figure: '21',
    line: 'For when saving £70 a year is not the problem.',
    back: 'Fixed triage order: danger, then food this week, then stopping creditors, then income, then the roof. Every route ends at a regulated human and carries the exact words to say when they pick up. Nobody else in consumer money has this.',
    source: 'lib/actions/crisisRoutes.ts, every number verified 31 July 2026',
    span: 'wide',
    tone: 'pink',
  },
  {
    id: 'market',
    eyebrow: 'Market, in order',
    figure: 'UK, IE',
    line: 'Europe is 27 entitlement systems, not one market.',
    back: 'Council Tax Reduction does not exist in Germany. Breathing Space is England and Wales only. The engine ports anywhere; the library does not, and that is the moat. Whoever builds a country\'s library first owns that country, because it is a year of verification, not a translation job.',
    source: 'Assessment based on scheme-level differences across EU welfare systems',
    tone: 'yellow',
  },
  {
    id: 'founder',
    eyebrow: 'Why this founder',
    figure: 'NONE',
    line: 'I built a money app, then needed one.',
    back: "Jobseeker's Allowance ran out at six months. Universal Credit was blocked by a property I could not sell. Debt, housing risk, two children. I opened my own app and it had nothing for me. The crisis path exists because I needed it and it was not there. Now Lead AI Product Design at NTT.",
    source: 'Gary P, founder',
    span: 'wide',
    tone: 'yellow',
  },
  {
    id: 'status',
    eyebrow: 'Where it actually is',
    figure: 'ZERO',
    line: 'No users yet. Said plainly, because you would find out.',
    back: 'Live and verified: 84 actions and crisis routes, every URL and figure checked against a live source, 546 automated assertions. Not yet launched, no revenue, no pilot signed. Quarterly re-verification of every entitlement is the standing commitment.',
    source: 'Repository state, 31 July 2026',
    tone: 'deep',
  },
]

/**
 * Contact. Email only, by decision.
 *
 * No phone number on the page. The only number in this repo is the Twilio sending line for app
 * SMS, which nobody can ring, and a pitch page with a dead number on it is worse than a pitch
 * page with none. If a phone line is ever wanted here it needs to be a real one someone answers.
 */
export const PAGER_CONTACT = {
  name: 'Gary P',
  email: 'gary@lomi-lomi.co.uk',
  site: '00-00.online',
}

export const PAGER_DOORS = [
  {
    label: 'Investment',
    body: 'Pre-seed, to launch in the UK and land the first pilot partners.',
  },
  {
    label: 'Partnership',
    body: 'Employers, housing associations, councils, credit unions and advice charities.',
  },
  {
    label: 'Advisers',
    body: 'Frontline debt and welfare advisers to review the crisis routes before public launch.',
  },
]
