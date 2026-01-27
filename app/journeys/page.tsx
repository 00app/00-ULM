'use client'

import { useRouter } from 'next/navigation'

export default function JourneysPage() {
  const router = useRouter()

  return (
    <div className="question-screen">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-3xl md:text-5xl text-h1">journeys</h1>
        <button
          onClick={() => router.push('/journeys/travel')}
          className="card-zero bg-ice border border-deep/10 p-6"
        >
          <p className="text-body">travel</p>
        </button>
      </div>
    </div>
  )
}
