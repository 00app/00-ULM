import { pageMetadata } from '@/lib/seo/siteMetadata'
import { MovingAgentClient } from '@/app/components/MovingAgentClient'

export const metadata = pageMetadata({
  title: 'Moving home checklist',
  description:
    'Everything to sort after a move, from council tax and DVLA to energy, water and insurance, with the official link for each and live figures for your new postcode.',
  path: '/agents/moving',
  index: false,
})

export default function MovingAgentPage() {
  return <MovingAgentClient />
}
