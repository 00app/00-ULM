import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/siteMetadata'

export const metadata: Metadata = pageMetadata({
  title: 'Saved',
  description:
    'The actions and offers you saved.',
  path: '/likes',
  index: false,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
