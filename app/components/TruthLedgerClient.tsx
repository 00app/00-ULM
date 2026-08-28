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
import SettingsBentoCard from '@/app/components/SettingsBentoCard'

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

function joinSummary(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' · ')
}

function epcVerifyUrl(postcode: string | null | undefined): string | null {
  const pc = (postcode ?? '').replace(/\s+/g, '').trim()
  if (pc.length < 4) return null
  return `https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodeURIComponent(pc)}`
}

function buildRegisterSummary(ledger: IntelligenceLedger): string {
  const pi = ledger.propertyIntelligence
  return joinSummary([
    humanize(pi?.confidence ?? 'postcode only'),
    pi?.epc?.currentEnergyRating
      ? `EPC ${pi.epc.currentEnergyRating}→${pi.epc.potentialEnergyRating ?? '—'}`
      : null,
    pi?.flood?.floodRiskZone ? `FLOOD ${humanize(pi.flood.floodRiskZone)}` : null,
    pi?.landRegistry?.propertyValueBand ? `VALUE ${humanize(pi.landRegistry.propertyValueBand)}` : null,
    pi?.dno?.dnoRegion ? `DNO ${humanize(pi.dno.dnoRegion)}` : null,
    pi?.deprivation?.imdDecile != null ? `IMD ${pi.deprivation.imdDecile}` : null,
    pi?.solar?.annualIrradianceKwhM2 != null ? `SOLAR ${pi.solar.annualIrradianceKwhM2} KWH/M²` : null,
    pi?.epc?.isStale ? 'EPC STALE' : null,
  ])
}

function buildProfileSummary(ledger: IntelligenceLedger): string {
  return joinSummary([
    humanize(ledger.profile.goal ?? 'goal unset'),
    `STEPS ${ledger.profile.profileStepsComplete}/${ledger.profile.profileStepsTotal}`,
    ledger.profile.homePower ? humanize(ledger.profile.homePower) : null,
    ledger.profile.employmentStatus ? humanize(ledger.profile.employmentStatus) : null,
    `LOOP ${ledger.counts.loopAnswersAnswered}/${ledger.counts.loopQuestionsTotal}`,
    ledger.profile.propertyPrefillCount > 0 ? `${ledger.profile.propertyPrefillCount} EPC PRE-FILLS` : null,
  ])
}

function buildBehaviourSummary(ledger: IntelligenceLedger): string {
  return joinSummary([
    `${ledger.counts.likes} LIKES`,
    `${ledger.counts.dislikes} DISLIKES`,
    `${ledger.counts.indifferent} INDIFFERENT`,
    `${ledger.counts.visitedJourneys} VISITED`,
    `${ledger.counts.actioned} ACTIONED`,
  ])
}

function buildJourneySummary(row: IntelligenceLedger['journeys'][number]): string {
  const save =
    row.savingGbp != null && row.savingGbp > 0 ? `SAVE £${Math.round(row.savingGbp)}` : 'SAVE —'
  const issues =
    row.issues.length > 0
      ? row.issues.map((id) => (ISSUE_LABELS[id] ?? id).toUpperCase()).join(' · ')
      : null
  return joinSummary([
    statusLabel(row.displayStatus),
    save,
    row.verified ? 'VERIFIED' : null,
    row.lastVisitedAt ? 'VISITED' : null,
    row.agentHeadline ? row.agentHeadline.toUpperCase() : null,
    issues ? `ISSUES ${issues}` : null,
  ])
}

function buildSignalSummary(sig: IntelligenceLedger['recentSignals'][number]): string {
  return joinSummary([
    (sig.journeyKey ?? '—').toUpperCase(),
    sig.feedbackAnswer?.toUpperCase(),
    formatWhen(sig.at),
  ])
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

  const epcUrl = epcVerifyUrl(ledger?.profile.postcode)

  return (
    <motion.div
      className="settings-page truth-ledger-page"
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
          <h4
            className="zz-h4 text-left max-w-[28rem] w-full mx-auto m-0 mb-4 px-[clamp(12px,4vw,24px)] box-border"
            style={{ color: 'var(--color-yellow)' }}
          >
            {error}
          </h4>
        ) : null}

        {ledger ? (
          <>
            <section className="settings-hero-section truth-ledger-hero" aria-label="Audit state">
              <motion.div
                className="settings-hero-inner"
                initial={cellMotion.initial}
                animate={cellMotion.animate}
                transition={{ ...stagger, delay: 0.08 }}
              >
                <SettingsBentoCard label="Source of truth" headline={formatAuditState(ledger.auditState)} isHero>
                  <div
                    className="text-left settings-overview-data truth-ledger-hero-metrics"
                    style={{ color: 'var(--color-yellow)', ['--color-ink' as string]: 'var(--color-yellow)' }}
                  >
                    <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-0 items-start settings-overview-impact-grid">
                      <span className="data-label text-marvin settings-overview-label">Potential cards</span>
                      <span className="data-label text-marvin settings-overview-label">Truthed cards</span>
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
                    <h4 className="truth-ledger-sync-line zz-h4 m-0">
                      {(ledger.profile.postcode ?? '—').toUpperCase()} · SYNCED {formatWhen(ledger.generatedAt)}
                    </h4>
                  </div>
                </SettingsBentoCard>
              </motion.div>
            </section>

            <section className="settings-cards-section settings-cards-section--ledger" aria-label="Truth ledger grid">
              <motion.div
                className="settings-answer-grid truth-ledger-grid"
                initial={cellMotion.initial}
                animate={cellMotion.animate}
                transition={{ ...stagger, delay: 0.1 }}
              >
                <motion.div className="settings-card-cell" transition={stagger}>
                  <SettingsBentoCard
                    label="Register"
                    headline={buildRegisterSummary(ledger)}
                    externalHref={epcUrl ?? undefined}
                    externalLabel="Verify EPC on gov.uk"
                  />
                </motion.div>

                <motion.div className="settings-card-cell" transition={{ ...stagger, delay: 0.06 }}>
                  <SettingsBentoCard label="Profile" headline={buildProfileSummary(ledger)} />
                </motion.div>

                <motion.div className="settings-card-cell" transition={{ ...stagger, delay: 0.12 }}>
                  <SettingsBentoCard
                    label="Behaviour"
                    headline={buildBehaviourSummary(ledger)}
                    editHref={ROUTES.LIKES}
                  />
                </motion.div>

                {ledger.journeys.map((row, i) => (
                  <motion.div
                    key={row.journeyId}
                    className="settings-card-cell"
                    transition={{ ...stagger, delay: 0.05 + (3 + i) * 0.04 }}
                  >
                    <SettingsBentoCard
                      label={row.journeyId.toUpperCase()}
                      headline={buildJourneySummary(row)}
                      externalHref={row.sourceUrl ?? row.offerUrl ?? undefined}
                      externalLabel={row.sourceUrl ? 'Open source' : row.offerUrl ? 'Open offer' : undefined}
                    />
                  </motion.div>
                ))}

                {ledger.recentSignals.map((sig, i) => (
                  <motion.div
                    key={`${sig.signal}-${sig.cardId}-${sig.at}`}
                    className="settings-card-cell"
                    transition={{ ...stagger, delay: 0.05 + (3 + ledger.journeys.length + i) * 0.04 }}
                  >
                    <SettingsBentoCard
                      label={sig.signal.toUpperCase()}
                      headline={joinSummary([(sig.cardTitle ?? sig.cardId).toUpperCase(), buildSignalSummary(sig)])}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          </>
        ) : null}
      </div>

      {!loading && !ledger && !error ? (
        <h4 className="zz-h4 text-center max-w-[28rem] w-full mx-auto m-0 mt-2" style={{ color: 'var(--color-yellow)' }}>
          No ledger data yet.
        </h4>
      ) : null}

      <div className="settings-cta-circles settings-cta-circles--tight z-10 relative">
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
    </motion.div>
  )
}
