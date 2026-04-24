import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ask Zai',
  description: 'UK-first assistant for savings, carbon, and journey questions.',
}

export default function ZaiLayout({ children }: { children: React.ReactNode }) {
  return children
}
