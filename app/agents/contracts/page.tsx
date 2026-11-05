import { pageMetadata } from '@/lib/seo/siteMetadata'
import { ContractsAgentClient } from '@/app/components/agents/ContractsAgentClient'

export const metadata = pageMetadata({
  title: 'Contract watch',
  description:
    'See which broadband, mobile, energy and insurance contracts are ending, so you are never left paying out-of-contract prices for the same thing.',
  path: '/agents/contracts',
  index: false,
})

export default function ContractsAgentPage() {
  return <ContractsAgentClient />
}
