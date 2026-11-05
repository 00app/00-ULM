import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageMetadata } from '@/lib/seo/siteMetadata'
import type { Metadata } from 'next'
import FrontDoor from '@/app/front-door/FrontDoor'
import '@/app/front-door/front-door.css'

/**
 * Public homepage: the front door (PRD v3, docs/HANDOFF-front-door-workspace.md), replacing the
 * old kinetic-intro splash. `/intro` keeps the old flow for existing bookmarks/links.
 * Server boundary only; all motion lives in the client component.
 */
export const metadata: Metadata = pageMetadata({
  title: DEFAULT_TITLE,
  absoluteTitle: true,
  description: DEFAULT_DESCRIPTION,
  path: '/',
})

export default function HomePage() {
  return <FrontDoor />
}
