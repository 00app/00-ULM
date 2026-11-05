import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/siteMetadata'

export const metadata: Metadata = pageMetadata({
  title: 'What your postcode costs you',
  description:
    'Live electricity and gas prices, grid carbon, solar yield and home rating for your postcode, every figure sourced.',
  path: '/start',
  index: false,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
