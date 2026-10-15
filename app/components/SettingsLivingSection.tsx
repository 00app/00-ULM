'use client'

import { useEffect, useState } from 'react'
import SettingsBentoCard from '@/app/components/SettingsBentoCard'
import {
  HOUSEHOLD_GROUP_LABELS,
  HOUSEHOLD_GROUP_ORDER,
  type HouseholdGroup,
} from '@/lib/household/categories'
import { ROUTES } from '@/lib/routes'

/**
 * Settings: "Living" — one card per household group (home, utilities, vehicle, subscriptions)
 * showing how many accounts are set up, plus a "Moved house?" entry. Counts come from
 * /api/household/summary (signed-in only; guests see "Not set up yet" everywhere).
 */
export function SettingsLivingSection() {
  const [counts, setCounts] = useState<Partial<Record<HouseholdGroup, number>>>({})

  useEffect(() => {
    let cancelled = false
    fetch('/api/household/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.counts) setCounts(data.counts)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="settings-cards-section" aria-label="Living" data-testid="settings-living">
      <div className="settings-answer-grid">
        {HOUSEHOLD_GROUP_ORDER.map((group) => {
          const n = counts[group] ?? 0
          return (
            <div key={group} className="settings-card-cell">
              <SettingsBentoCard
                label={HOUSEHOLD_GROUP_LABELS[group]}
                headline={n > 0 ? `${n} set up` : 'Not set up yet'}
                editHref={`${ROUTES.SETTINGS_LIVING}/${group}`}
                cardId={`settings-living-${group}`}
              />
            </div>
          )
        })}
        <div className="settings-card-cell">
          <SettingsBentoCard
            label="Moving"
            headline="Moved house?"
            editHref={`${ROUTES.SETTINGS_LIVING}/move`}
            cardId="settings-living-move"
          />
        </div>
      </div>
    </section>
  )
}
