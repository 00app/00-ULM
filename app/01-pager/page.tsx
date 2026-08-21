import type { Metadata } from 'next'
import PagerClient from './PagerClient'

/**
 * Zero Zero one-pager, at /01-pager.
 *
 * Deliberately noindex. The page says "pre-launch, no users yet" in plain English, which is the
 * right call for something handed to an investor on purpose and the wrong thing to have surface
 * in search next to the live product. Remove `robots` when the story changes.
 *
 * Uses the real Zone card look deliberately, not an approximation of it: PagerClient's nine
 * fact cards render with the actual `bento-card-groovy`/`card-headline`/`data-value` classes
 * from app/globals.css and the real `ZoneBentoCardHeader` component, so the page can only ever
 * look like the product it is pitching, not drift from it over time. This one-way dependency is
 * safe in the direction it runs: nothing here is imported by anything else, so deleting this
 * folder still removes the page and only the page.
 */
export const metadata: Metadata = {
  title: 'Zero Zero, one pager',
  description:
    'UK households are owed £24 billion a year in support they qualify for and never claim. Zero Zero finds it, and routes people in trouble to human help.',
  robots: { index: false, follow: false },
}

export default function OnePagerPage() {
  return <PagerClient />
}
