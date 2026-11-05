import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/siteMetadata'

export const metadata: Metadata = pageMetadata({
  title: 'Ask Zai',
  description:
    'Ask questions about your bills, contracts and the help you can get.',
  path: '/zai',
  index: false,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
