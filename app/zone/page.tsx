'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '../context/AppContext'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { buildZoneViewModel } from '@/lib/zone/buildZoneViewModel'
import type { ZoneViewModel } from '@/lib/zone/buildZoneViewModel'

import Card from '../components/Card'
import Sheet from '../components/Sheet'
import FloatingNav from '../components/FloatingNav'
import JourneyGrid from '../components/JourneyGrid'
import InputField from '../components/InputField'
import CircleCTA from '../components/CircleCTA'

export default function ZonePage() {
  const router = useRouter()
  const { state } = useApp()

  const [viewModel, setViewModel] = useState<ZoneViewModel | null>(null)
  const [completedJourneys, setCompletedJourneys] = useState<JourneyId[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [askZero, setAskZero] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    const storedCompleted: JourneyId[] =
      JSON.parse(localStorage.getItem('completedJourneys') || '[]')
    setCompletedJourneys(storedCompleted)

    // Load journey answers
    const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    JOURNEY_ORDER.forEach((journeyId) => {
      const stored = localStorage.getItem(`journey_${journeyId}_answers`)
      if (stored) {
        journeyAnswers[journeyId] = JSON.parse(stored)
      }
    })

    // Build Zone view model from calculations
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
  }, [state.profile])

  const handleCardClick = (card: any) => {
    setSelected(card)
    setSheetOpen(true)
  }

  const completedCount = completedJourneys.length
  let level = 'ok for starters'
  if (completedCount >= 4) {
    level = 'amazingly'
  } else if (completedCount >= 2) {
    level = 'really well'
  } else if (completedCount === 1) {
    level = 'good start'
  }

  // buildZoneViewModel ALWAYS returns a valid viewModel (guaranteed shape)
  // No null checks needed - viewModel is always defined
  if (!viewModel) {
    // Fallback: create minimal viewModel if somehow undefined
    const emptyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    const fallbackVm = buildZoneViewModel({
      profile: {},
      journeyAnswers: emptyAnswers,
    })
    setViewModel(fallbackVm)
    return null // Return null during initial render
  }

  return (
    <main className="zone">
      {/* TAGLINE */}
      <div className="zone-tagline">
        <span>USE LESS.</span>
        <span>MORE.</span>
      </div>

      {/* HEADER */}
      <header className="zone-header">
        <div className="zone-logo">
          <svg
            width="51"
            height="auto"
            viewBox="0 0 126 200"
            fill="none"
            style={{ width: '100%', height: 'auto' }}
          >
            <path
              d="M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z"
              fill="#000AFF"
            />
            <path
              d="M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z"
              fill="#000AFF"
            />
            <path
              d="M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411"
              fill="#000AFF"
            />
          </svg>
        </div>

        <h3 className="zone-message">
          {state.profile?.name ? (
            <>
              <span className="zone-message-name">{state.profile.name.toLowerCase()}.</span>{' '}
              <span className="zone-message-muted">you're doing</span>{' '}
              <span className="zone-message-strong">{level}.</span>
            </>
          ) : (
            <span className="zone-message-name">welcome to zero zero.</span>
          )}
        </h3>

        <div className="zone-ask-zero safe-bottom">
          <InputField
            value={askZero}
            onChange={setAskZero}
            onAdvance={() => router.push('/zai')}
            placeholder="ask zero."
          />
        </div>
      </header>

      {/* ZONE CONTENT CONTAINER */}
      <div className="zone-content-container">
        {/* A. HERO CARD */}
        <div className="zone-grid">
          <Card
            variant="card-hero"
            onClick={() => handleCardClick(viewModel.hero)}
            title={viewModel.hero.title}
            journey={viewModel.hero.journey_key}
            category={viewModel.hero.category}
            source={viewModel.hero.source}
            sourceLabel={viewModel.hero.sourceLabel}
            data={{
              carbon: viewModel.hero.data.carbon,
              money: viewModel.hero.data.money,
            }}
          />
        </div>

        {/* B. JOURNEY RECOMMENDATIONS GRID */}
        <h4 className="zone-label" style={{ marginTop: '40px' }}>
          act now.
        </h4>
        <div className="zone-grid">
          {viewModel.journeys.map((journey, index) => (
            <Card
              key={journey.id}
              variant="card-standard"
              onClick={() => handleCardClick(journey)}
              title={journey.title}
              journey={journey.journey_key}
              category={journey.category}
              source={journey.source}
              sourceLabel={journey.sourceLabel}
              data={{
                carbon: journey.data.carbon,
                money: journey.data.money,
              }}
            />
          ))}
        </div>

        {/* C. PROFILE-BASED TIPS */}
        <h4 className="zone-label" style={{ marginTop: '40px' }}>
          tips.
        </h4>
        <div className="zone-grid">
          {viewModel.tips.map((tip) => (
            <Card
              key={tip.id}
              variant="card-compact"
              onClick={() => handleCardClick(tip)}
              title={tip.title}
              journey={tip.journey_key}
              category={tip.category}
              source={tip.source}
              sourceLabel={tip.sourceLabel}
              data={{
                carbon: tip.data.carbon,
                money: tip.data.money,
              }}
            />
          ))}
        </div>

        {/* D. LOAD MORE MODULE */}
        <div
          style={{
            width: '100%',
            padding: '40px 20px',
            textAlign: 'center',
            marginTop: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <h4 className="zone-label" style={{ margin: 0, color: 'var(--color-deep)' }}>
            get more personalised tips
          </h4>
          <CircleCTA
            variant="text"
            text="log in"
            onClick={() => setShowAuthModal(true)}
          />
        </div>

        {/* E. JOURNEY PROGRESSION */}
        <div className="zone-incomplete-wrapper">
          <div className="incomplete-container">
            <h4 className="incomplete-label">explore more.</h4>
            <JourneyGrid
              completedJourneys={completedJourneys}
              onJourneyClick={(id) => router.push(`/journeys/${id}`)}
              showLabel={false}
            />
          </div>
        </div>
      </div>

      {/* NAV */}
      <FloatingNav
        active="zone"
        onNavigate={(key) => {
          if (key === 'likes') router.push('/likes')
          if (key === 'zone') router.push('/zone')
          if (key === 'summary') router.push('/settings')
          if (key === 'chat') router.push('/zai')
        }}
      />

      {/* SHEET */}
      {selected && (
        <Sheet
          isOpen={sheetOpen}
          onClose={() => {
            setSheetOpen(false)
            setSelected(null)
          }}
          data={{
            id: selected.id,
            title: selected.title,
            subtitle: selected.subtitle,
            body: (selected as any).explanation?.length
              ? (selected as any).explanation
              : selected.subtitle ? [selected.subtitle] : undefined,
            data: selected.data ? { money: selected.data.money, carbon: selected.data.carbon } : undefined,
            source: selected.source,
            sourceLabel: (selected as any).sourceLabel,
            journey: selected.journey_key as JourneyId,
            actions: (selected as any).actions ?? {
              actionType: 'learn',
              learnUrl: selected.source || 'https://www.gov.uk',
            },
          }}
        />
      )}
    </main>
  )
}
