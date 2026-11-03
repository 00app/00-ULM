import type { Metadata } from 'next'
import FrontDoor from './FrontDoor'
import './front-door.css'

export const metadata: Metadata = {
  title: 'Zero Zero: stop overpaying for your home',
  description:
    'Your bills, subscriptions and contracts in one workspace. Zero Zero finds what you are overpaying for, shows you why and prepares the fix. Every figure sourced.',
}

/** Public front door. Server boundary only; all motion lives in the client component. */
export default function FrontDoorPage() {
  return <FrontDoor />
}
