'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { IntelligenceLedger } from '@/lib/intelligence/intelligenceLedgerTypes'
import type { TruthLedgerDisplayStatus } from '@/lib/intelligence/intelligenceLedgerTypes'
import { ROUTES } from '@/lib/routes'
import {
  FAMILY_DUR_SHORT,
  FAMILY_EASE,
  familyAtomicProps,
  familyPageEnterProps,
} from '@/lib/motion-family'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import SettingsBentoCard, {
  SettingsJourneyCardShell,
  SettingsJourneyFactRow,
} from '@/app/components/SettingsBentoCard'

const ISSUE_LABELS: Record<string, string> = {
  no_neon_row: 'No Neon research row',
  prose_sanitizer_rejected: 'Prose failed sanitizer',
  prose_category_bleed: 'Prose wrong category',
  headline_not_acceptable: 'Headline not acceptable',
  headline_topic_conflict: 'Headline topic conflict',
  not_settled: 'Insight not settled',
}

function formatAuditState(state: IntelligenceLedger['auditState']): string {
  if (state === 'LIVE_AUDIT') return 'LIVE AUDIT'
  if (state === 'PROPERTY_VERIFIED') return 'PROPERTY VERIFIED'
  return 'ESTIMATED AUDIT'
}

function statusLabel(status: TruthLedgerDisplayStatus): string {
  return status.replace(/_/g, ' ').toUpperCase()
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').toUpperCase()
}

function epcVerifyUrl(postcode: string | null | undefined): string | null {
  const pc = (postcode ?? '').replace(/\s+/g, '').trim()
  if (pc.length < 4) return null
  return `https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodeURIComponent(pc)}`
}

export default function TruthLedgerClient() {
  const reduceMotion = useHydrationSafeReducedMotion()
  const cellMotion = familyAtomicProps(reduceMotion)
  const pageEnter = familyPageEnterProps(reduceMotion)
  const stagger = reduceMotion
    ? { duration: 0.12, ease: 'linear' as const }
    : { duration: FAMILY_DUR_SHORT, ease: FAMILY_EASE }

  const [ledger, setLedger] = useState<IntelligenceLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/intelligence/ledger', { credentials: 'include', cache: 'no-store' })
      if (res.status === 401) {
        setError('Sign in via profile to view your truth ledger.')
        setLedger(null)
        return
      }
      if (!res.ok) {
        setError('Could not load truth ledger.')
        setLedger(null)
        return
      }
      const data = (await res.json()) as { ledger?: IntelligenceLedger }
      setLedger(data.ledger ?? null)
    } catch {
      setError('Network error loading truth ledger.')
      setLedger(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pi = ledger?.propertyIntelligence
  const epcUrl = epcVerifyUrl(ledger?.profile.postcode)

  return (
    <motion.div
      className="settings-page"
      style={{
        color: 'var(--color-yellow)',
        minHeight: '100vh',
        position: 'relative',
        paddingTop: 20,
        paddingBottom: 0,
      }}
      initial={pageEnter.initial}
      animate={pageEnter.animate}
      transition={pageEnter.transition}
    >
      <ZoneBackToZoneLink />

      <div className="settings-heading-wrap">
        <h3 className="zz-page-title">Truth ledger</h3>
      </div>

      <div className="settings-grid-wrap">
        {error ? (
          <h4 className="zz-h4 text-left max-w-[28rem] w-full mx-auto m-0 mb-4 px-[clamp(12px,4vw,24px)] box-border" style={{ color: 'var(--color-yellow)' }}>
            {error}
          </h4>
        ) : null}

        {ledger ? (
          <>
            <section className="settings-hero-section" aria-label="Audit state">
              <motion.div
                className="settings-hero-inner"
                initial={cellMotion.initial}
                animate={cellMotion.animate}
                transition={{ ...stagger, delay: 0.08 }}
              >
                <SettingsBentoCard label="Source of truth" headline={formatAuditState(ledger.auditState)} isHero>
                  <div
                    className="text-left mt-1 settings-overview-data"
                    style={{ color: 'var(--color-yellow)', ['--color-ink' as string]: 'var(--color-yellow)' }}
                  >
                    <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-0 items-start settings-overview-impact-grid">
                      <span className="data-label text-marvin settings-overview-label">Potential</span>
                      <span className="data-label text-marvin settings-overview-label">Truth</span>
                      <span
                        className="data-value text-marvin font-bold settings-data-value data-stamp-metric"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        {ledger.counts.potentialSavings}
                      </span>
                      <span
                        className="data-value text-marvin font-bold settings-data-value data-stamp-metric"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        {ledger.counts.truthSavings}
                      </span>
                    </div>
                    <h4 className="settings-council-blurb">
                      {ledger.profile.postcode?.toUpperCase() ?? '—'} · synced {formatWhen(ledger.generatedAt)}
                    </h4>
                  </div>
                </SettingsBentoCard>
              </motion.div>
            </section>

            <section className="settings-cards-section" aria-label="Register, profile, behaviour">
              <motion.div
                className="settings-answer-grid"
                initial={cellMotion.initial}
                animate={cellMotion.animate}
                transition={{ ...stagger, delay: 0.1 }}
              >
                <motion.div className="settings-card-cell" transition={stagger}>
                  <SettingsBentoCard
                    label="Register"
                    headline={humanize(pi?.confidence ?? 'postcode only')}
                    externalHref={epcUrl ?? undefined}
                    externalLabel="Verify EPC on gov.uk"
                  >
                    <div className="flex flex-col gap-2 settings-journey-answers">
                      {pi?.epc?.currentEnergyRating ? (
                        <SettingsJourneyFactRow
                          label="EPC"
                          value={`${pi.epc.currentEnergyRating} → ${pi.epc.potentialEnergyRating ?? '—'}`}
                        />
                      ) : null}
                      {pi?.deprivation?.imdDecile != null ? (
                        <SettingsJourneyFactRow label="IMD decile" value={String(pi.deprivation.imdDecile)} />
                      ) : null}
                      {pi?.flood?.floodRiskZone ? (
                        <SettingsJourneyFactRow label="Flood" value={humanize(pi.flood.floodRiskZone)} />
                      ) : null}
                      {pi?.solar?.annualIrradianceKwhM2 != null ? (
                        <SettingsJourneyFactRow label="Solar" value={`${pi.solar.annualIrradianceKwhM2} kWh/m²/yr`} />
                      ) : null}
                      {pi?.landRegistry?.propertyValueBand ? (
                        <SettingsJourneyFactRow label="Value band" value={humanize(pi.landRegistry.propertyValueBand)} />
                      ) : null}
                      {pi?.dno?.dnoRegion ? (
                        <SettingsJourneyFactRow label="DNO" value={humanize(pi.dno.dnoRegion)} />
                      ) : null}
                      {pi?.epc?.isStale ? (
                        <SettingsJourneyFactRow label="EPC" value="STALE (>10YR)" />
                      ) : null}
                    </div>
                  </SettingsBentoCard>
                </motion.div>

                <motion.div className="settings-card-cell" transition={{ ...stagger, delay: 0.06 }}>
                  <SettingsBentoCard label="Profile" headline={humanize(ledger.profile.goal ?? 'goal unset')}>
                    <div className="flex flex-col gap-2 settings-journey-answers">
                      <SettingsJourneyFactRow
                        label="Steps"
                        value={`${ledger.profile.profileStepsComplete}/${ledger.profile.profileStepsTotal}`}
                      />
                      <SettingsJourneyFactRow label="Power" value={humanize(ledger.profile.homePower ?? '—')} />
                      <SettingsJourneyFactRow
                        label="Employed"
                        value={humanize(ledger.profile.employmentStatus ?? '—')}
                      />
                      <SettingsJourneyFactRow
                        label="Loop"
                        value={`${ledger.counts.loopAnswersAnswered}/${ledger.counts.loopQuestionsTotal}`}
                      />
                      {ledger.profile.propertyPrefillCount > 0 ? (
                        <SettingsJourneyFactRow
                          label="EPC pre-fills"
                          value={String(ledger.profile.propertyPrefillCount)}
                        />
                      ) : null}
                    </div>
                  </SettingsBentoCard>
                </motion.div>

                <motion.div className="settings-card-cell" transition={{ ...stagger, delay: 0.12 }}>
                  <SettingsBentoCard label="Behaviour" headline={`${ledger.counts.likes} LIKES`} editHref={ROUTES.LIKES}>
                    <div className="flex flex-col gap-2 settings-journey-answers">
                      <SettingsJourneyFactRow label="Dislikes" value={String(ledger.counts.dislikes)} />
                      <SettingsJourneyFactRow label="Indifferent" value={String(ledger.counts.indifferent)} />
                      <SettingsJourneyFactRow label="Visited" value={String(ledger.counts.visitedJourneys)} />
                      <SettingsJourneyFactRow label="Actioned" value={String(ledger.counts.actioned)} />
                    </div>
                  </SettingsBentoCard>
                </motion.div>
              </motion.div>
            </section>

            <section className="settings-cards-section" aria-label="Journey research gates">
              <motion.div className="settings-answer-grid" transition={stagger}>
                {ledger.journeys.map((row, i) => (
                  <motion.div
                    key={row.journeyId}
                    className="settings-card-cell"
                    initial={cellMotion.initial}
                    animate={cellMotion.animate}
                    transition={{ ...stagger, delay: 0.05 + i * 0.06 }}
                  >
                    <SettingsJourneyCardShell
                      label={row.journeyId.toUpperCase()}
                      externalHref={row.sourceUrl ?? row.offerUrl ?? undefined}
                      externalLabel={row.sourceUrl ? 'Open source' : row.offerUrl ? 'Open offer' : undefined}
                    >
                      <SettingsJourneyFactRow label="Status" value={statusLabel(row.displayStatus)} />
                      <SettingsJourneyFactRow
                        label="Save"
                        value={row.savingGbp != null && row.savingGbp > 0 ? `£${Math.round(row.savingGbp)}` : '—'}
                      />
                      {row.verified ? <SettingsJourneyFactRow label="Verified" value="YES" /> : null}
                      {row.lastVisitedAt ? <SettingsJourneyFactRow label="Visited" value="YES" /> : null}
                      {row.agentHeadline ? (
                        <SettingsJourneyFactRow label="Headline" value={row.agentHeadline} />
                      ) : null}
                      {row.issues.length > 0 ? (
                        <SettingsJourneyFactRow
                          label="Issues"
                          value={row.issues.map((id) => ISSUE_LABELS[id] ?? id).join(' · ')}
                        />
                      ) : null}
                      {row.offerUrl && row.sourceUrl ? (
                        <SettingsJourneyFactRow label="Offer" value="LINK IN ARROW" />
                      ) : null}
                    </SettingsJourneyCardShell>
                  </motion.div>
                ))}
              </motion.div>
            </section>

            {ledger.recentSignals.length > 0 ? (
              <section className="settings-cards-section" aria-label="Recent signals">
                <motion.div className="settings-answer-grid" transition={stagger}>
                  {ledger.recentSignals.map((sig, i) => (
                    <motion.div
                      key={`${sig.signal}-${sig.cardId}-${sig.at}`}
                      className="settings-card-cell"
                      initial={cellMotion.initial}
                      animate={cellMotion.animate}
                      transition={{ ...stagger, delay: 0.05 + i * 0.06 }}
                    >
                      <SettingsBentoCard
                        label={sig.signal.toUpperCase()}
                        headline={(sig.cardTitle ?? sig.cardId).toUpperCase()}
                      >
                        <div className="flex flex-col gap-2 settings-journey-answers">
                          <SettingsJourneyFactRow label="Journey" value={(sig.journeyKey ?? '—').toUpperCase()} />
                          {sig.feedbackAnswer ? (
                            <SettingsJourneyFactRow label="Feedback" value={sig.feedbackAnswer.toUpperCase()} />
                          ) : null}
                          <SettingsJourneyFactRow label="When" value={formatWhen(sig.at)} />
                        </div>
                      </SettingsBentoCard>
                    </motion.div>
                  ))}
                </motion.div>
              </section>
            ) : null}
          </>
        ) : null}

        {!loading && !ledger && !error ? (
          <h4 className="zz-h4 text-center max-w-[28rem] w-full mx-auto m-0 mt-2" style={{ color: 'var(--color-yellow)' }}>
            No ledger data yet.
          </h4>
        ) : null}

        <div className="settings-cta-circles mt-8 z-10 relative">
          <motion.button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="settings-circle-cta settings-circle-cta--yellow"
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            transition={stagger}
            aria-label="Refresh truth ledger"
          >
            <span className="settings-circle-cta__label zz-h4">{loading ? 'SYNCING' : 'REFRESH'}</span>
          </motion.button>
          <Link
            href={ROUTES.SETTINGS}
            className="settings-circle-cta settings-circle-cta--yellow"
            aria-label="Back to settings"
          >
            <span className="settings-circle-cta__label zz-h4">
              BACK TO
              <br />
              SETTINGS
            </span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
