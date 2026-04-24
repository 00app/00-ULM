import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Likes',
  description: 'Liked journey and tip cards from your Zone.',
}

export default function LikesLayout({ children }: { children: React.ReactNode }) {
  return children
}
