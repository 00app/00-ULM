'use client'

import { useRouter } from 'next/navigation'
import CircleCTA from '../components/CircleCTA'

export default function SplashPage() {
  const router = useRouter()

  const handleStart = () => {
    router.push('/profile')
  }

  const handleSkip = () => {
    // Skip goes directly to Fork (bypass profile)
    router.push('/fork')
  }

  return (
    <div className="question-screen relative">
      <div className="flex flex-col items-center gap-12">
        <h1 className="animate-fade-up stagger-1">
          welcome to
        </h1>
        <div className="mt-8">
          <CircleCTA onClick={handleStart} variant="text" text="start" />
        </div>
      </div>
      
      <button
        onClick={handleSkip}
        className="absolute top-8 right-8 text-body text-deep/60"
        style={{ fontFamily: 'Roboto', fontSize: 16, lineHeight: '18px', fontWeight: 400 }}
      >
        skip
      </button>
    </div>
  )
}
