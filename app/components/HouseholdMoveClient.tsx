'use client'

import { useCallback, useEffect, useState } from 'react'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import {
  ALL_HOUSEHOLD_CATEGORIES,
  HOUSEHOLD_CATEGORY_LABELS,
  MOVE_CHECKLIST_STATUSES,
  MOVE_CHECKLIST_STATUS_LABELS,
  type HouseholdCategory,
  type MoveChecklistStatus,
} from '@/lib/household/categories'

type HouseholdMove = {
  id: string
  from_postcode: string | null
  to_postcode: string
  move_date: string | null
  checklist_jsonb: Record<string, unknown>
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '2px solid var(--color-purple)',
  background: 'var(--surface-page)',
  color: 'var(--color-ink)',
  fontSize: 'var(--zz-body-size-desktop)',
  outline: 'none',
}

function statusOf(move: HouseholdMove, category: HouseholdCategory): MoveChecklistStatus {
  const v = move.checklist_jsonb[category]
  return v === 'transferred' || v === 'cancel' || v === 'set_up_new' ? v : 'pending'
}

/** Settings → Living → Moving: start a move, then work through the per-category checklist. */
export function HouseholdMoveClient() {
  const [move, setMove] = useState<HouseholdMove | null>(null)
  const [signedIn, setSignedIn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toPostcode, setToPostcode] = useState('')
  const [fromPostcode, setFromPostcode] = useState('')
  const [moveDate, setMoveDate] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/household/moves')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSignedIn(Boolean(data?.signedIn))
        setMove(data?.move ?? null)
      })
      .catch(() => setMove(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startMove = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/household/moves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_postcode: toPostcode,
          from_postcode: fromPostcode || null,
          move_date: moveDate || null,
        }),
      })
      if (res.ok) load()
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (category: HouseholdCategory, status: MoveChecklistStatus) => {
    if (!move) return
    setMove({ ...move, checklist_jsonb: { ...move.checklist_jsonb, [category]: status } })
    await fetch(`/api/household/moves/${move.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, status }),
    })
  }

  return (
    <div className="settings-page" style={{ color: 'var(--color-blue)', minHeight: '100vh', paddingTop: 20 }}>
      <ZoneBackToZoneLink />
      <div className="settings-heading-wrap">
        <h3 className="zz-page-title">Moving</h3>
      </div>

      {!signedIn && !loading ? (
        <p className="data-label" style={{ padding: '0 16px' }}>
          Sign in to track a move and its checklist.
        </p>
      ) : null}

      {!loading && signedIn && !move ? (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
          <p className="data-label">New postcode, and the one you're leaving if you want it noted.</p>
          <input
            type="text"
            placeholder="Moving to postcode"
            value={toPostcode}
            onChange={(e) => setToPostcode(e.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Moving from postcode (optional)"
            value={fromPostcode}
            onChange={(e) => setFromPostcode(e.target.value)}
            style={inputStyle}
          />
          <input
            type="date"
            placeholder="Move date (optional)"
            value={moveDate}
            onChange={(e) => setMoveDate(e.target.value)}
            style={inputStyle}
          />
          <button
            type="button"
            className="zone-rec-cta"
            disabled={saving || !toPostcode.trim()}
            onClick={startMove}
            style={{ opacity: saving || !toPostcode.trim() ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Start checklist'}
          </button>
        </div>
      ) : null}

      {move ? (
        <div style={{ padding: '0 16px', maxWidth: 480 }}>
          <p className="data-label">
            {move.from_postcode ? `${move.from_postcode} → ` : 'Moving to '}
            {move.to_postcode}
            {move.move_date ? ` · ${move.move_date}` : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {ALL_HOUSEHOLD_CATEGORIES.map((category) => (
              <div
                key={category}
                className="bento-card-groovy settings-bento-card"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
              >
                <h4 className="zz-h4" style={{ margin: 0 }}>
                  {HOUSEHOLD_CATEGORY_LABELS[category]}
                </h4>
                <select
                  value={statusOf(move, category)}
                  onChange={(e) => setStatus(category, e.target.value as MoveChecklistStatus)}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  {MOVE_CHECKLIST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {MOVE_CHECKLIST_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
