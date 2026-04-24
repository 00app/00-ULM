'use client'

import { Suspense } from 'react'
import ProfilePageClient from '@/app/profile/ProfilePageClient'

export default function ProfilePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--color-purple)' }} />}>
      <ProfilePageClient />
    </Suspense>
  )
}
