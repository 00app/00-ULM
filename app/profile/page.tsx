'use client'

/**
 * Profile onboarding lives in `ProfilePageClient` (v6.1: `SHIMMER_FOCUS` step shell + staggered answer bloom).
 */
import { Suspense } from 'react'
import ProfilePageClient from '@/app/profile/ProfilePageClient'

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageClient />
    </Suspense>
  )
}
