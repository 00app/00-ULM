'use client'

import { useEffect, useMemo, useState } from 'react'
import { SUBSCRIPTION_SERVICES, subscriptionService } from '@/lib/cards/subscriptionCatalog'
import {
  buildSubscriptionAudit,
  clearSubscriptionAnswers,
  formatGbpFromPence,
  readSubscriptionAnswers,
  saveSubscriptionsToBills,
  writeSubscriptionAnswers,
  type SubscriptionEntry,
  type SubscriptionUse,
} from '@/lib/cards/subscriptionAudit'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'

type Step = 'pick' | 'detail' | 'result'

const USE_OPTIONS: { id: SubscriptionUse; label: string }[] = [
  { id: 'often', label: 'Often' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'rarely', label: 'Rarely' },
]

/**
 * Ask-first subscriptions card. Three short steps on the card itself, then a personal answer:
 * 1. Which do you pay for? (multi-select chips)
 * 2. For each: plan, how often you use it, and what you pay if we have no sourced price.
 * 3. Your total, what you could stop paying, where to cancel, and save to bills.
 *
 * Answers persist on the device, so the card opens on the answer next time. Skipping is always
 * allowed; the generic tip stays visible underneath for anyone who skips.
 */
export function SubscriptionAuditCard({ onAnswered }: { onAnswered?: (answered: boolean) => void }) {
  const [step, setStep] = useState<Step>('pick')
  const [entries, setEntries] = useState<SubscriptionEntry[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'signed_out' | 'error'>('idle')

  useEffect(() => {
    const stored = readSubscriptionAnswers()
    if (stored && stored.entries.length > 0) {
      setEntries(stored.entries)
      setStep('result')
      onAnswered?.(true)
    }
    // Read once on open; onAnswered is a stable parent setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedIds = useMemo(() => new Set(entries.map((e) => e.serviceId)), [entries])
  const audit = useMemo(() => buildSubscriptionAudit(entries), [entries])

  const toggle = (serviceId: string) => {
    setEntries((prev) =>
      prev.some((e) => e.serviceId === serviceId)
        ? prev.filter((e) => e.serviceId !== serviceId)
        : [...prev, { serviceId, planId: subscriptionService(serviceId)?.plans.length === 1 ? subscriptionService(serviceId)!.plans[0].id : null, ownMonthlyPence: null, use: null }]
    )
  }

  const update = (serviceId: string, patch: Partial<SubscriptionEntry>) =>
    setEntries((prev) => prev.map((e) => (e.serviceId === serviceId ? { ...e, ...patch } : e)))

  const finish = () => {
    const withLabels = entries.map((e) => (e.label != null ? { ...e, label: e.label.trim() || null } : e))
    writeSubscriptionAnswers(withLabels)
    setEntries(withLabels)
    setStep('result')
    onAnswered?.(true)
    trackFunnelEvent('cta_click', { card_id: 'journey-cancel-unused-subscriptions', cta_label: 'subscription_audit_complete', money_value: Math.round(buildSubscriptionAudit(withLabels).potentialYearlyPence / 100) })
  }

  const restart = () => {
    clearSubscriptionAnswers()
    setEntries([])
    setSaveState('idle')
    setStep('pick')
    onAnswered?.(false)
  }

  const save = async () => {
    setSaveState('saving')
    setSaveState(await saveSubscriptionsToBills(audit.lines))
  }

  return (
    <section className="sub-audit" aria-label="Your subscriptions">
      {step === 'pick' ? (
        <>
          <p className="sub-audit__q">Which do you pay for?</p>
          <p className="sub-audit__hint">Tap all that apply. We use this to work out your own saving.</p>
          <div className="sub-audit__chips" role="group" aria-label="Subscriptions you pay for">
            {SUBSCRIPTION_SERVICES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`sub-audit__chip${selectedIds.has(s.id) ? ' is-on' : ''}`}
                aria-pressed={selectedIds.has(s.id)}
                onClick={() => toggle(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="sub-audit__actions">
            <button type="button" className="sub-audit__primary" disabled={entries.length === 0} onClick={() => setStep('detail')}>
              Next{entries.length > 0 ? ` (${entries.length})` : ''}
            </button>
          </div>
        </>
      ) : null}

      {step === 'detail' ? (
        <>
          <p className="sub-audit__q">Which plan, and how often do you use it?</p>
          <ul className="sub-audit__rows">
            {entries.map((e) => {
              const svc = subscriptionService(e.serviceId)
              if (!svc) return null
              const plan = svc.plans.find((p) => p.id === e.planId) ?? null
              const needsAmount = !plan || plan.monthlyPence == null
              const groupId = `sub-${svc.id}`
              return (
                <li key={svc.id} className="sub-audit__row">
                  <p className="sub-audit__name" id={`${groupId}-name`}>
                    {svc.name}
                  </p>
                  {svc.id === 'gym' || svc.id === 'other' ? (
                    <label className="sub-audit__field">
                      <span>Name</span>
                      <input
                        type="text"
                        value={e.label ?? ''}
                        onChange={(ev) => update(svc.id, { label: ev.target.value })}
                        placeholder={svc.id === 'gym' ? 'e.g. PureGym' : 'e.g. Audible'}
                      />
                    </label>
                  ) : null}
                  {svc.plans.length > 1 ? (
                    <div className="sub-audit__chips sub-audit__chips--small" role="group" aria-labelledby={`${groupId}-name`}>
                      {svc.plans.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`sub-audit__chip${e.planId === p.id ? ' is-on' : ''}`}
                          aria-pressed={e.planId === p.id}
                          onClick={() => update(svc.id, { planId: p.id })}
                        >
                          {p.label}
                          {p.monthlyPence != null ? ` · ${formatGbpFromPence(p.monthlyPence)}` : ''}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {needsAmount ? (
                    <label className="sub-audit__field">
                      <span>What you pay a month (leave blank if not sure)</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={e.ownMonthlyPence != null ? (e.ownMonthlyPence / 100).toString() : ''}
                        onChange={(ev) => {
                          const v = parseFloat(ev.target.value)
                          update(svc.id, { ownMonthlyPence: Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null })
                        }}
                        placeholder="£"
                      />
                    </label>
                  ) : null}
                  <div className="sub-audit__chips sub-audit__chips--small" role="group" aria-label={`How often you use ${svc.name}`}>
                    {USE_OPTIONS.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className={`sub-audit__chip${e.use === u.id ? ' is-on' : ''}`}
                        aria-pressed={e.use === u.id}
                        onClick={() => update(svc.id, { use: u.id })}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="sub-audit__actions">
            <button type="button" className="sub-audit__secondary" onClick={() => setStep('pick')}>
              Back
            </button>
            <button type="button" className="sub-audit__primary" onClick={finish}>
              Show my saving
            </button>
          </div>
        </>
      ) : null}

      {step === 'result' ? (
        <div aria-live="polite">
          <p className="sub-audit__q">
            You pay {formatGbpFromPence(audit.knownMonthlyPence)} a month ({formatGbpFromPence(audit.knownMonthlyPence * 12)} a year)
            {audit.unknownCount > 0 ? `, plus ${audit.unknownCount} we don't have a price for` : ''}.
          </p>
          {audit.potentialYearlyPence > 0 ? (
            <p className="sub-audit__headline">You could stop paying {formatGbpFromPence(audit.potentialYearlyPence)} a year.</p>
          ) : null}
          {audit.suggestions.length > 0 ? (
            <ul className="sub-audit__rows">
              {audit.suggestions.map((s) => (
                <li key={`${s.type}-${'serviceId' in s ? s.serviceId : s.names.join('-')}`} className="sub-audit__row">
                  {s.type === 'cancel_rarely' ? (
                    <p className="sub-audit__line">
                      You rarely use <strong>{s.name}</strong>. Cancelling saves {formatGbpFromPence(s.yearlyPence)} a year.
                    </p>
                  ) : s.type === 'downgrade' ? (
                    <p className="sub-audit__line">
                      <strong>{s.name}</strong>: moving from {s.fromPlan} to {s.toPlan} saves {formatGbpFromPence(s.yearlyPence)} a year.
                    </p>
                  ) : (
                    <p className="sub-audit__line">
                      You pay for {s.names.length} music services ({s.names.join(' and ')}). If one would do
                      {s.cheapestYearlyPence != null ? `, dropping the cheaper saves ${formatGbpFromPence(s.cheapestYearlyPence)} a year` : ', drop the one you use less'}.
                    </p>
                  )}
                  {'manageUrl' in s && s.manageUrl ? (
                    <a className="sub-audit__link" href={s.manageUrl} target="_blank" rel="noopener noreferrer">
                      Manage or cancel {s.name}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="sub-audit__line">Nothing to cut: you use everything you pay for. Check again when a price rises.</p>
          )}
          <p className="sub-audit__source">
            Prices: your own figures where you gave them, otherwise list prices from{' '}
            {Array.from(
              new Set(
                audit.lines
                  .filter((l) => l.priceFrom === 'list')
                  .map((l) => subscriptionService(l.serviceId)?.priceSource?.name)
                  .filter((n): n is string => Boolean(n))
              )
            ).join('; ') || 'no list price used'}
            .
          </p>
          <div className="sub-audit__actions">
            <button type="button" className="sub-audit__primary" onClick={() => void save()} disabled={saveState === 'saving' || saveState === 'saved'}>
              {saveState === 'saved' ? 'Added to your bills' : saveState === 'saving' ? 'Adding' : 'Add to my bills'}
            </button>
            <button type="button" className="sub-audit__secondary" onClick={restart}>
              Change answers
            </button>
          </div>
          {saveState === 'signed_out' ? (
            <p className="sub-audit__hint">Saved on this device. Sign in to keep them in your bills.</p>
          ) : saveState === 'error' ? (
            <p className="sub-audit__hint">Could not save just now. Your answers are kept on this device.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
