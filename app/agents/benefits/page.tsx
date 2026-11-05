import { pageMetadata } from '@/lib/seo/siteMetadata'
import { BenefitsAgentClient } from '@/app/components/agents/BenefitsAgentClient'

export const metadata = pageMetadata({
  title: 'Benefits check',
  description:
    'The benefits, discounts and social tariffs your household could be missing, starting with a free benefits check. Every figure linked to its source.',
  path: '/agents/benefits',
  index: false,
})

export default function BenefitsAgentPage() {
  return <BenefitsAgentClient />
}
