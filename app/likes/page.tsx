'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '@/app/context/AppContext'
import FloatingNav from '@/app/components/FloatingNav'

export default function LikesPage() {
  const { state } = useApp()
  const router = useRouter()
  const likedIds = state.likedCards

  return (
    <div className="zz-page">
      <Link href="/zone" className="zz-page-back">
        ← Zone
      </Link>
      <h1 className="zz-page-title">Liked cards</h1>
      <p className="zz-body zz-page-intro">
        Cards you’ve liked will appear here. Like cards from the Zone to see them.
      </p>
      {likedIds.length === 0 ? (
        <p className="zz-body">No liked cards yet.</p>
      ) : (
        <ul className="zz-list">
          {likedIds.map((id) => (
            <li key={id} className="zz-list-item">
              {id}
            </li>
          ))}
        </ul>
      )}
      <FloatingNav
        active="likes"
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
