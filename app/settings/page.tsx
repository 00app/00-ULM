'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '@/app/context/AppContext'
import ZButton from '@/app/components/ZButton'
import FloatingNav from '@/app/components/FloatingNav'

export default function SettingsPage() {
  const { state } = useApp()
  const router = useRouter()

  return (
    <div className="zz-page">
      <Link href="/zone" className="zz-page-back">
        ← Zone
      </Link>
      <h1 className="zz-page-title">Settings</h1>
      <div className="zz-page-section">
        <ZButton href="/profile">Edit profile</ZButton>
        <p className="zz-body" style={{ margin: 0 }}>
          {state.profile?.name ? `Signed in as ${state.profile.name}.` : 'Complete your profile from the Zone flow.'}
        </p>
      </div>
      <FloatingNav
        active="summary"
        onNavigate={(key) => {
          if (key === 'likes') router.push('/likes')
          if (key === 'zone') router.push('/zone')
          if (key === 'summary') router.push('/settings')
          if (key === 'chat') router.push('/zai')
        }}
      />
    </div>
  )
}
