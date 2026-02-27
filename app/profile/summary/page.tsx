'use client'

import Link from 'next/link'
import { useApp } from '@/app/context/AppContext'
import { useEffect, useState } from 'react'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { buildZoneViewModel } from '@/lib/zone/buildZoneViewModel'

export default function ProfileSummaryPage() {
  const { state } = useApp()
  const p = state.profile
  const [totals, setTotals] = useState<{ money: string; carbon: string } | null>(null)

  useEffect(() => {
    const profile = p
      ? {
          name: p.name,
          postcode: p.postcode,
          household: p.livingSituation,
          home_type: p.homeType,
          transport_baseline: p.transport,
          age: p.age,
        }
      : {}
    const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    JOURNEY_ORDER.forEach((journeyId) => {
      if (typeof localStorage === 'undefined') return
      const stored = localStorage.getItem(`journey_${journeyId}_answers`)
      if (stored) journeyAnswers[journeyId] = JSON.parse(stored)
    })
    const vm = buildZoneViewModel({ profile, journeyAnswers })
    setTotals({
      money: vm.hero.data.money,
      carbon: vm.hero.data.carbon,
    })
  }, [p])

  return (
    <div className="zz-page summary-page summary-page--groovy">
      <Link href="/profile" className="zz-page-back zz-label">
        ← Back
      </Link>

      <h1 className="zz-h2 summary-page__title">Summary</h1>
      <p className="zz-body summary-page__intro">
        Here’s what we’ve got. You can change it anytime from settings.
      </p>

      {/* Stacked 60s-colored panels — 48px radius (big bold audit) */}
      <div className="summary-panels">
        <section className="summary-panel summary-panel--profile" aria-label="Your profile">
          <h2 className="zz-label summary-panel__heading">Profile</h2>
          <dl className="summary-panel__list">
            <div className="summary-panel__row">
              <dt className="zz-label">Name</dt>
              <dd className="zz-body">{p?.name ?? '—'}</dd>
            </div>
            <div className="summary-panel__row">
              <dt className="zz-label">Postcode</dt>
              <dd className="zz-body">{p?.postcode || '—'}</dd>
            </div>
            <div className="summary-panel__row">
              <dt className="zz-label">Household</dt>
              <dd className="zz-body">{p?.livingSituation || '—'}</dd>
            </div>
            <div className="summary-panel__row">
              <dt className="zz-label">Home</dt>
              <dd className="zz-body">{p?.homeType || '—'}</dd>
            </div>
            <div className="summary-panel__row">
              <dt className="zz-label">Transport</dt>
              <dd className="zz-body">{p?.transport || '—'}</dd>
            </div>
            <div className="summary-panel__row">
              <dt className="zz-label">Age</dt>
              <dd className="zz-body">{p?.age ?? '—'}</dd>
            </div>
          </dl>
        </section>

        {totals && (
          <section className="summary-panel summary-panel--impact" aria-label="Your impact">
            <h2 className="zz-label summary-panel__heading">Your impact</h2>
            <div className="summary-impact">
              <span className="hero-total summary-impact__money" style={{ color: 'var(--color-burnt)' }}>{totals.money}</span>
              <span className="zz-label summary-impact__unit">/ yr</span>
              <span className="hero-total summary-impact__carbon" style={{ color: 'var(--color-burnt)', fontSize: 'clamp(60px, 15vw, 100px)' }}>{totals.carbon}</span>
              <span className="zz-label summary-impact__unit">kg CO₂e / yr</span>
            </div>
          </section>
        )}
      </div>

      {/* Massive screen-wide BLUE pill CTA */}
      <Link href="/zone" className="summary-cta">
        Go to Zone
      </Link>
    </div>
  )
}
