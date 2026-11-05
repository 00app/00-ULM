import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageMetadata } from '@/lib/seo/siteMetadata'
import type { Metadata } from 'next'
import FrontDoor from './FrontDoor'
import './front-door.css'

export const metadata: Metadata = pageMetadata({
  title: DEFAULT_TITLE,
  absoluteTitle: true,
  description: DEFAULT_DESCRIPTION,
  path: '/',
})

/** Public front door. Server boundary only; all motion lives in the client component. */
export default function FrontDoorPage() {
  return <FrontDoor />
}
