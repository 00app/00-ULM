import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/siteMetadata'

export const metadata: Metadata = pageMetadata({
  title: 'Zero Zero',
  description:
    'Stop overpaying for your home.',
  path: '/',
  index: false,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
