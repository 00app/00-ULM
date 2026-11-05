import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Your profile, bank connection, household accounts and data controls.',
  robots: { index: false, follow: true },
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
