'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../context/AppContext'
import { Card, FloatingNav, CircleCTA, AuthModal } from '../components'
import { JOURNEY_ORDER, JOURNEYS, type JourneyId } from '@/lib/journeys'
import { formatCarbon } from '@/lib/format'
import { buildZoneViewModel } from '@/lib/zone/buildZoneViewModel'

export default function SettingsPage() {
  const router = useRouter()
  const { state, setUserId } = useApp()

  // Load journey answers and build view model
  const [viewModel, setViewModel] = useState<ReturnType<typeof buildZoneViewModel> | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load answers dynamically from localStorage
  const loadAnswers = () => {
    // Guard: localStorage only available in browser
    if (typeof window === 'undefined') {
      return {} as Record<JourneyId, Record<string, string>>
    }
    
    const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    JOURNEY_ORDER.forEach((journeyId) => {
      const stored = localStorage.getItem(`journey_${journeyId}_answers`)
      if (stored) {
        try {
          journeyAnswers[journeyId] = JSON.parse(stored)
        } catch {
          // ignore parse errors
        }
      }
    })
    return journeyAnswers
  }

  // Build view model on mount and when profile changes
  useEffect(() => {
    // Ensure we're in the browser
    if (typeof window === 'undefined') {
      return
    }

    const buildViewModel = () => {
      try {
        const journeyAnswers = loadAnswers()
        console.log('[Settings] Building view model with answers:', journeyAnswers)

        // Build view model to get hero data
        const vm = buildZoneViewModel({
          profile: {
            name: state.profile?.name,
            postcode: state.profile?.postcode,
            household: state.profile?.livingSituation,
            home_type: state.profile?.homeType,
            transport_baseline: state.profile?.transport,
          },
          journeyAnswers,
        })
        
        console.log('[Settings] View model built successfully:', vm)
        
        // Validation: Check journey answers completeness
        JOURNEY_ORDER.forEach((journeyId) => {
          const answers = journeyAnswers[journeyId]
          const journey = JOURNEYS[journeyId]
          if (journey && answers && Object.keys(answers).length > 0) {
            const missingQuestions = journey.questions.filter(q => !answers[q.id] || answers[q.id] === '?' || answers[q.id] === 'UNKNOWN')
            if (missingQuestions.length > 0) {
              console.warn(`[Settings] Journey ${journeyId} missing answers for: ${missingQuestions.map(q => q.id).join(', ')}`)
            }
          }
        })
        
        // Validation: Check calculation sources
        if (vm.hero && !vm.hero.source) {
          console.error('[Settings] Hero card missing source')
        }
        vm.journeys.forEach((journey) => {
          if (!journey.source) {
            console.error(`[Settings] Journey card ${journey.journey_key} missing source`)
          }
        })
        
        setViewModel(vm)
        setError(null)
        return true
      } catch (error) {
        console.error('[Settings] Error building view model:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setError(errorMessage)
        // Create a minimal fallback view model so page can still render
        try {
          console.log('[Settings] Attempting fallback view model...')
          const emptyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<JourneyId, Record<string, string>>
          JOURNEY_ORDER.forEach((journeyId) => {
            emptyAnswers[journeyId] = {}
          })
          const fallbackVm = buildZoneViewModel({
            profile: undefined,
            journeyAnswers: emptyAnswers,
          })
          console.log('[Settings] Fallback view model created:', fallbackVm)
          setViewModel(fallbackVm)
          setError(null)
          return true
        } catch (fallbackError) {
          console.error('[Settings] Fallback view model also failed:', fallbackError)
          setError(`Failed to load: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`)
          return false
        }
      }
    }

    // Try to build immediately
    if (!buildViewModel()) {
      // If it fails, try again after a short delay
      const timeout = setTimeout(() => {
        buildViewModel()
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [state.profile])

  // Re-render when localStorage changes (listen for storage events)
  useEffect(() => {
    // Guard: window only available in browser
    if (typeof window === 'undefined') {
      return
    }
    
    const handleStorageChange = () => {
      try {
        const journeyAnswers = loadAnswers()
        const vm = buildZoneViewModel({
          profile: {
            name: state.profile?.name,
            postcode: state.profile?.postcode,
            household: state.profile?.livingSituation,
            home_type: state.profile?.homeType,
            transport_baseline: state.profile?.transport,
          },
          journeyAnswers,
        })
        setViewModel(vm)
      } catch (error) {
        console.error('[Settings] Error handling storage change:', error)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    // Also listen for custom events (for same-tab updates)
    window.addEventListener('journey-answers-updated', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('journey-answers-updated', handleStorageChange)
    }
  }, [state.profile])
  
  // Validation: Ensure buttons are 80x80 (runtime check)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const checkButtonSizes = () => {
        const buttons = document.querySelectorAll('.circle-cta')
        buttons.forEach((btn, idx) => {
          const rect = btn.getBoundingClientRect()
          if (Math.abs(rect.width - 80) > 1 || Math.abs(rect.height - 80) > 1) {
            console.error(`[Settings] Button ${idx} is not 80x80. Size: ${rect.width}x${rect.height}`)
          }
        })
      }
      // Check after render
      setTimeout(checkButtonSizes, 100)
    }
  }, [viewModel])

  // Helper to get full journey answers as stacked text lines
  const getJourneyAnswersText = (journeyId: JourneyId): string => {
    // Guard: localStorage only available in browser
    if (typeof window === 'undefined') {
      return 'not started.'
    }
    
    const stored = localStorage.getItem(`journey_${journeyId}_answers`)
    if (!stored) return 'not started.'
    
    try {
      const answers = JSON.parse(stored)
      const journey = JOURNEYS[journeyId]
      if (!journey) return 'not started.'
      
      console.log('[SETTINGS]', journeyId, answers)
      
      // Build lines: label: answer
      const lines: string[] = []
      journey.questions.forEach((q) => {
        const answer = answers[q.id]
        if (answer && answer !== '?' && answer !== 'UNKNOWN') {
          lines.push(`${q.label} ${answer.toLowerCase()}`)
        }
      })
      
      if (lines.length === 0) return 'not started.'
      return lines.join('\n')
    } catch {
      return 'not started.'
    }
  }

  const handleEditJourney = (journeyId: JourneyId) => {
    router.push(`/journeys/${journeyId}`)
  }


  // Show loading state until client-side hydration and view model are ready
  if (!isClient || !viewModel) {
    return (
      <div className="min-h-screen bg-ice p-4 safe-bottom">
        <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto' }}>
          <h1 className="mb-8 text-center">settings.</h1>
          {error ? (
            <div style={{ textAlign: 'center', color: 'var(--color-deep)' }}>
              <p>Error loading settings: {error}</p>
              <button
                className="zz-button"
                onClick={() => window.location.reload()}
                style={{ marginTop: 20 }}
              >
                reload
              </button>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--color-deep)' }}>loading...</p>
          )}
        </div>
      </div>
    )
  }

  // Build profile summary text as readable pairs
  const profile = state.profile
  const profileLines: string[] = []
  if (profile?.name) profileLines.push(`name: ${profile.name.toLowerCase()}`)
  if (profile?.postcode) profileLines.push(`postcode: ${profile.postcode.toLowerCase()}`)
  if (profile?.livingSituation) profileLines.push(`household: ${profile.livingSituation.toLowerCase()}`)
  if (profile?.homeType) profileLines.push(`home: ${profile.homeType.toLowerCase()}`)
  if (profile?.transport) profileLines.push(`transport: ${profile.transport.toLowerCase()}`)
  const profileSummary = profileLines.length > 0 
    ? profileLines.join('\n')
    : 'no profile data yet.'

  const handleEditProfile = () => {
    router.push('/profile')
  }

  const handleReset = async () => {
    // Guard: localStorage only available in browser
    if (typeof window === 'undefined') {
      return
    }
    
    // Clear all localStorage data
    const keysToRemove = [
      'userId',
      'user_id',
      'userPostcode',
      'userEmail',
      'completedJourneys',
      'likedCards',
      // Profile keys (if they exist)
      'profile_name',
      'profile_postcode',
      'profile_household',
      'profile_home_type',
      'profile_transport',
    ]
    
    // Remove all journey answer keys
    JOURNEY_ORDER.forEach((journeyId) => {
      keysToRemove.push(`journey_${journeyId}_answers`)
    })

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key)
    })
    
    // Also clear all localStorage keys that start with profile_ or journey_
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('profile_') || key.startsWith('journey_')) {
        localStorage.removeItem(key)
      }
    })

    // Call reset API if user_id exists
    if (state.userId) {
      try {
        await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: state.userId }),
        })
      } catch (error) {
        console.error('Reset API error:', error)
      }
    }

    // Redirect to intro (this will reset AppContext state on reload)
    router.push('/intro')
  }

  const handleLogin = () => {
    // Guard: localStorage only available in browser
    if (typeof window === 'undefined') {
      return
    }
    
    // If logged in, logout
    if (state.userId) {
      // Clear auth state from localStorage
      localStorage.removeItem('userId')
      localStorage.removeItem('user_id')
      localStorage.removeItem('userEmail')
      // Clear from AppContext state (setUserId expects string, so use empty string)
      setUserId('')
      // Refresh page to reset app state
      window.location.reload()
    } else {
      // Open auth modal
      setShowAuthModal(true)
    }
  }

  return (
    <div className="min-h-screen bg-ice p-4 safe-bottom">
      <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto' }}>
        {/* Page title */}
        <h1 className="mb-8 text-center">settings.</h1>

        {/* A. PROFILE CARD - Using card-liked variant (full width) */}
        <div style={{ width: '100%', marginBottom: 40 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Card
              variant="card-liked"
              title="your profile"
              category="profile"
              subtitle={profileSummary}
              data={{
                carbon: viewModel.hero.data.carbon,
                money: viewModel.hero.data.money,
              }}
              sourceLabel="source. your answers"
              image={null} // Explicitly no images on Settings page
            />
            {/* Edit button (CircleCTA) - positioned at bottom right */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              zIndex: 10,
            }}>
              <CircleCTA
                text="edit"
                onClick={handleEditProfile}
              />
            </div>
          </div>
        </div>

        {/* B. JOURNEY ANSWERS - Exactly 9 cards, one per journey - ALL card-liked variant (full width) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
          {JOURNEY_ORDER.map((journeyId) => {
            const answersText = getJourneyAnswersText(journeyId)
            const journeyCard = viewModel.journeys.find(j => j.journey_key === journeyId)
            
            // Validation: Ensure source is present
            if (journeyCard && !journeyCard.source) {
              console.error(`[Settings] Journey card ${journeyId} missing source`)
            }
            
            // Validation: Settings page uses card-liked variant only (enforced by explicit variant prop)
            // No need to check journeyCard.variant as we explicitly set variant="card-liked" below
            
            return (
              <div key={journeyId} style={{ position: 'relative', width: '100%' }}>
                <Card
                  variant="card-liked"
                  title={journeyCard?.title || journeyId}
                  journey={journeyId}
                  category={journeyId}
                  subtitle={answersText}
                  data={journeyCard?.data || { carbon: '0kg', money: '£0' }}
                  source={journeyCard?.source}
                  sourceLabel={journeyCard?.sourceLabel}
                  image={null} // Explicitly no images on Settings page
                />
                {/* Edit button (pencil icon) */}
                <button
                  onClick={() => handleEditJourney(journeyId)}
                  style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    border: 'none',
                    background: 'var(--color-cool)',
                    color: 'var(--color-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>

        {/* C. ACTIONS ROW - Reset and Log/Signin buttons (at bottom, text not arrows) */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 40,
          marginTop: 60,
          marginBottom: 40,
        }}>
          <CircleCTA
            variant="text"
            text="reset"
            onClick={handleReset}
          />
          <CircleCTA
            variant="text"
            text="log/signin"
            onClick={handleLogin}
          />
        </div>

        {/* FloatingNav */}
        <FloatingNav
          active="summary"
          onNavigate={(key) => {
            if (key === 'likes') router.push('/likes')
            if (key === 'zone') router.push('/zone')
            if (key === 'summary') router.push('/settings')
            if (key === 'chat') router.push('/zai')
          }}
        />

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    </div>
  )
}
