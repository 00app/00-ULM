import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Profile, overview, and machine reset.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
