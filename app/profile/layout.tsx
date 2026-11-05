import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/siteMetadata'

export const metadata: Metadata = pageMetadata({
  title: 'Your profile',
  description:
    'Tell Zero Zero about your home so it can find what you are overpaying for.',
  path: '/profile',
  index: false,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
