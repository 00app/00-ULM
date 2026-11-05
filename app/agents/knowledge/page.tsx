import { pageMetadata } from '@/lib/seo/siteMetadata'
import { KnowledgeAgentClient } from '@/app/components/agents/KnowledgeAgentClient'

export const metadata = pageMetadata({
  title: 'Know your home',
  description:
    'A few quick answers about your home that sharpen the savings Zero Zero finds for you.',
  path: '/agents/knowledge',
  index: false,
})

export default function KnowledgeAgentPage() {
  return <KnowledgeAgentClient />
}
