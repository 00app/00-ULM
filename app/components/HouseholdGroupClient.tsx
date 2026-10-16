'use client'

import { useCallback, useEffect, useState } from 'react'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import SettingsBentoCard from '@/app/components/SettingsBentoCard'
import {
  HOUSEHOLD_CATEGORIES,
  HOUSEHOLD_CATEGORY_LABELS,
  HOUSEHOLD_GROUP_LABELS,
  type HouseholdCategory,
  type HouseholdGroup,
} from '@/lib/household/categories'
import { getHouseholdCategoryTip } from '@/lib/household/livingTips'

type HouseholdAccount = {
  id: string
  category: HouseholdCategory
  provider_name: string | null
  nickname: string | null
  monthly_amount_pence: number | null
  renewal_date: string | null
  contract_end_date: string | null
}

const gbp = (pence: number | null) =>
  typeof pence === 'number' ? `£${(pence / 100).toFixed(2)}` : null

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

/** Settings → Living → one group: list what's set up, add or end an account. Signed-in only. */
export function HouseholdGroupClient({ group }: { group: HouseholdGroup }) {
  const categories = HOUSEHOLD_CATEGORIES[group]
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([])
  const [signedIn, setSignedIn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState<HouseholdCategory>(categories[0])
  const [providerName, setProviderName] = useState('')
  const [nickname, setNickname] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [renewalDate, setRenewalDate] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/household/accounts?group=${group}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSignedIn(Boolean(data?.signedIn))
        setAccounts(Array.isArray(data?.accounts) ? data.accounts : [])
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  }, [group])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const pence = monthlyAmount.trim() ? Math.round(parseFloat(monthlyAmount) * 100) : null
      const res = await fetch('/api/household/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          provider_name: providerName.trim() || null,
          nickname: nickname.trim() || null,
          monthly_amount_pence: Number.isFinite(pence) ? pence : null,
          renewal_date: renewalDate || null,
        }),
      })
      if (res.ok) {
        setProviderName('')
        setNickname('')
        setMonthlyAmount('')
        setRenewalDate('')
        load()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleEnd = async (id: string) => {
    const res = await fetch(`/api/household/accounts/${id}`, { method: 'DELETE' })
    if (res.ok) setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="settings-page" style={{ color: 'var(--color-blue)', minHeight: '100vh', paddingTop: 20 }}>
      <ZoneBackToZoneLink />
      <div className="settings-heading-wrap">
        <h3 className="zz-page-title">{HOUSEHOLD_GROUP_LABELS[group]}</h3>
      </div>

      {!signedIn && !loading ? (
        <p className="data-label" style={{ padding: '0 16px' }}>
          Sign in to set up and keep {HOUSEHOLD_GROUP_LABELS[group].toLowerCase()} on file.
        </p>
      ) : null}

      <div className="settings-answer-grid" style={{ padding: '0 16px' }}>
        {accounts.map((a) => (
          <div key={a.id} className="settings-card-cell">
            <SettingsBentoCard
              label={HOUSEHOLD_CATEGORY_LABELS[a.category]}
              headline={a.nickname || a.provider_name || HOUSEHOLD_CATEGORY_LABELS[a.category]}
            >
              <p className="data-label" style={{ margin: '4px 0 0' }}>
                {[a.provider_name, gbp(a.monthly_amount_pence) ? `${gbp(a.monthly_amount_pence)}/mo` : null]
                  .filter(Boolean)
                  .join(' · ') || 'No details yet'}
              </p>
              <p className="data-label" style={{ margin: '8px 0 0', opacity: 0.8, fontStyle: 'italic' }}>
                {getHouseholdCategoryTip(a.category)}
              </p>
              <button
                type="button"
                className="zone-rec-cta"
                style={{ marginTop: 12 }}
                onClick={() => handleEnd(a.id)}
              >
                Remove
              </button>
            </SettingsBentoCard>
          </div>
        ))}
        {!loading && accounts.length === 0 ? (
          <p className="data-label">Nothing set up yet for {HOUSEHOLD_GROUP_LABELS[group].toLowerCase()}.</p>
        ) : null}
      </div>

      <div
        style={{
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxWidth: 480,
        }}
      >
        <h4 className="zz-h4" style={{ margin: 0 }}>
          Add one
        </h4>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as HouseholdCategory)}
          style={inputStyle}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {HOUSEHOLD_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Who's it with? (e.g. Octopus Energy)"
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Your own label (optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Monthly amount, £ (optional)"
          value={monthlyAmount}
          onChange={(e) => setMonthlyAmount(e.target.value)}
          style={inputStyle}
        />
        <input
          type="date"
          placeholder="Renewal date (optional)"
          value={renewalDate}
          onChange={(e) => setRenewalDate(e.target.value)}
          style={inputStyle}
        />
        <button
          type="button"
          className="zone-rec-cta"
          disabled={saving}
          onClick={handleAdd}
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  )
}
