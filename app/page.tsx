import type { Metadata } from 'next'
import FrontDoor from '@/app/front-door/FrontDoor'
import '@/app/front-door/front-door.css'

/**
 * Public homepage: the front door (PRD v3, docs/HANDOFF-front-door-workspace.md), replacing the
 * old kinetic-intro splash. `/intro` keeps the old flow for existing bookmarks/links.
 * Server boundary only; all motion lives in the client component.
 */
export const metadata: Metadata = {
  title: 'Zero Zero: stop overpaying for your home',
  description:
    'Your bills, subscriptions and contracts in one workspace. Zero Zero finds what you are overpaying for, shows you why and prepares the fix. Every figure sourced.',
}

export default function HomePage() {
  return <FrontDoor />
}
