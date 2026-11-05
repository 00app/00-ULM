import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/siteMetadata'

export const metadata: Metadata = pageMetadata({
  title: 'What your postcode costs you',
  description:
    'Enter your postcode to see what living there costs right now: the live electricity and gas price, how clean your grid is, your solar yield and your home\u2019s energy rating. Free, every figure sourced.',
  path: '/start',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
