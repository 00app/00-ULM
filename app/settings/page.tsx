'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import { useRouter } from 'next/navigation'
import { useApp, type ProfileAge } from '@/app/context/AppContext'
import { motion } from 'framer-motion'
import { JOURNEY_ORDER, JOURNEYS, getFunkyOptionDisplay, type JourneyId } from '@/lib/journeys'
import { ROUTES } from '@/lib/routes'
import { ENGINE_UI_LABELS } from '@/lib/logic/engine'
import { SPRING_TAP, SPRING_BLOOM, KINETIC_ZIP_PULSE } from '@/lib/animations'
import { SoloFocusOverlay } from '@/app/components/SoloFocusOverlay'
import { AnimatePresence } from 'framer-motion'
import { buildZoneViewModel } from '@/lib/logic/zone'
import { useCountUp } from '@/lib/utils/useCountUp'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { clearLocalStorageExceptProfileAndUser } from '@/lib/utils/migrate'
import { UNIFIED_PROFILE_MEMORY_EVENT } from '@/lib/unifiedProfileMemory'

const PROFILE_LABELS: Record<string, string> = {
  name: "What's your name?",
  postcode: 'Your postcode?',
  livingSituation: 'Who do you live with?',
  homeType: 'Your home?',
  transport: 'How do you get around?',
  age: 'How old are you?',
}

/** v1.8.3 — purge cached client state; keep `userId` / `user_id` and `profile_*` keys. */
function clearMachineStorage() {
  clearLocalStorageExceptProfileAndUser()
}

/** Pencil icon for edit — same slot as card-top-arrow */
function PencilIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

const ICON_SIZE = 44

/** Pin drop — Update location */
function PinIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/** Tick — Save */
function TickIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** Reset / clear — circular arrows */
function ResetIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

const CARD_TEXT = { default: 'var(--color-purple)', hero: 'var(--color-yellow)' } as const

/** One cell in the grid: bento-card-groovy (existing), yellow bg purple text, or hero (pink bg yellow text) */
function SettingsBentoCard({
  label,
  headline,
  editHref,
  children,
  isHero = false,
}: {
  label: string
  headline: string
  editHref?: string
  children?: React.ReactNode
  isHero?: boolean
}) {
  const textColor = isHero ? CARD_TEXT.hero : CARD_TEXT.default
  const bgColor = isHero ? 'var(--color-pink)' : 'var(--color-yellow)'
  const card = (
    <div
      className={`bento-card-groovy settings-bento-card settings-card-bento flex flex-col justify-between w-full h-full ${isHero ? 'settings-hero-card' : ''}`.trim()}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        boxShadow: 'none',
      }}
    >
      <div className="flex items-center justify-between w-full shrink-0">
        <span className="card-top-label" style={{ color: textColor }}>
          {label}
        </span>
        {editHref ? (
          <Link href={editHref} className="card-top-arrow flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, color: textColor }} aria-label={`Edit: ${label}`}>
            <PencilIcon />
          </Link>
        ) : (
          <span style={{ width: 42, height: 42 }} aria-hidden />
        )}
      </div>
      <h3 className="card-headline m-0" style={{ color: textColor }}>
        {headline}
      </h3>
      {children}
    </div>
  )
  return card
}

const SHORT_QUESTION_LABELS: Record<string, string> = {
  energy_type: 'Heating',
  home_insulation_level: 'Insulation',
  electricity_provider: 'Elec Provider',
  gas_provider: 'Gas Provider',
  monthly_cost: 'Monthly Cost',
  green_tariff: 'Green Tariff',
  primary_transport: 'Commute',
  fuel_type: 'Fuel',
  distance_amount: 'Distance',
  distance_period: 'Period',
  diet_type: 'Diet',
  food_waste: 'Food Waste',
  buy_new: 'Buy New',
  secondhand: 'Secondhand',
  monthly_spend: 'Monthly Spend',
  biggest_cost: 'Biggest Cost',
  finances_tight: 'Tight Finances',
  tracking: 'Carbon Tracking',
  priority: 'Carbon Priority',
  upgrade_often: 'Phone Upgrade',
  device_count: 'Device Count',
  recycle: 'Recycle',
  compost: 'Compost',
  fly_frequency: 'Fly Frequency',
  long_haul: 'Long Haul',
}

export default function SettingsPage() {
  const { state } = useApp()
  const router = useRouter()
  const [hasMounted, setHasMounted] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [liveTotals, setLiveTotals] = useState<{ savings: number; carbon: number } | null>(null)
  const [activeJourneyEdit, setActiveJourneyEdit] = useState<{ id: JourneyId; title: string } | null>(null)
  
  useEffect(() => setHasMounted(true), [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMemory = () => setRefreshKey((k) => k + 1)
    window.addEventListener(UNIFIED_PROFILE_MEMORY_EVENT, onMemory)
    return () => window.removeEventListener(UNIFIED_PROFILE_MEMORY_EVENT, onMemory)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/summary?type=profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        const savings = Number(d?.savings)
        const carbon = Number(d?.carbon)
        if (Number.isFinite(savings) && Number.isFinite(carbon)) {
          setLiveTotals({ savings: Math.max(0, savings), carbon: Math.max(0, carbon) })
        }
      })
      .catch(() => {
        if (!cancelled) setLiveTotals(null)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, state.profile?.postcode, state.journeyAnswers])

  const profileForOverview = useMemo(() => {
    void refreshKey
    const p = state.profile
    if (p) return p
    if (typeof window === 'undefined' || !hasMounted) return null
    const name = localStorage.getItem('profile_name') ?? ''
    const postcode = localStorage.getItem('profile_postcode') ?? ''
    const livingSituation = localStorage.getItem('profile_household') ?? ''
    const homeType = localStorage.getItem('profile_home_type') ?? ''
    const transport = localStorage.getItem('profile_transport') ?? ''
    const age = localStorage.getItem('profile_age') ?? ''
    if (!name && !postcode) return null
    const employmentStatus = localStorage.getItem('profile_employment_status') ?? ''
    return { name, postcode, livingSituation, homeType, transport, age, employmentStatus }
  }, [state.profile, hasMounted, refreshKey])

  const profileRows = useMemo(() => {
    if (!profileForOverview) return []
    const rows: { id: string; question: string; answer: string }[] = []
    const map: Record<string, string> = {
      name: profileForOverview.name ?? '',
      postcode: profileForOverview.postcode ?? '',
      livingSituation: profileForOverview.livingSituation ?? '',
      homeType: profileForOverview.homeType ?? '',
      transport: profileForOverview.transport ?? '',
      age: profileForOverview.age ?? '',
    }
    ;(['name', 'postcode', 'livingSituation', 'homeType', 'transport', 'age'] as const).forEach((key) => {
      const val = map[key]?.trim()
      if (val) rows.push({ id: key, question: PROFILE_LABELS[key] ?? key, answer: val })
    })
    return rows
  }, [profileForOverview])

  const journeyCardsData = useMemo(() => {
    void refreshKey
    if (typeof window === 'undefined' || !hasMounted) return []
    const cards: { journey: JourneyId; title: string; answers: { question: string; answer: string }[] }[] = []
    JOURNEY_ORDER.forEach((jid) => {
      const raw = localStorage.getItem(`journey_${jid}_answers`)
      if (!raw) return
      try {
        const ans = JSON.parse(raw) as Record<string, string>
        const def = JOURNEYS[jid]
        if (!def) return
        const answers: { question: string; answer: string }[] = []
        def.questions.forEach((q) => {
          const v = ans[q.id]?.trim()
          if (v) answers.push({ question: SHORT_QUESTION_LABELS[q.id] || q.label, answer: getFunkyOptionDisplay(v) || v })
        })
        if (answers.length > 0) cards.push({ journey: jid as JourneyId, title: def.name, answers })
      } catch {
        // ignore
      }
    })
    return cards
  }, [hasMounted, refreshKey])

  const journeyAnswers = useMemo((): Record<JourneyId, Record<string, string>> => {
    void refreshKey
    void state.journeyAnswers
    if (typeof window === 'undefined' || !hasMounted) return {} as Record<JourneyId, Record<string, string>>
    const out = {} as Record<JourneyId, Record<string, string>>
    JOURNEY_ORDER.forEach((jid) => {
      const raw = localStorage.getItem(`journey_${jid}_answers`)
      if (!raw) return
      try {
        out[jid] = JSON.parse(raw) as Record<string, string>
      } catch {
        // ignore
      }
    })
    return out
  }, [hasMounted, refreshKey, state.journeyAnswers])

  const viewModel = useMemo(() => {
    const validAges: ProfileAge[] = ['JUNIOR', 'MID', 'RETIRED']
    const ageRaw = profileForOverview?.age
    const age: ProfileAge | undefined =
      ageRaw && validAges.includes(ageRaw as ProfileAge) ? (ageRaw as ProfileAge) : undefined
    const employmentRaw = profileForOverview?.employmentStatus?.trim() || ''
    const profile = profileForOverview
      ? {
          name: profileForOverview.name,
          postcode: profileForOverview.postcode,
          household: profileForOverview.livingSituation,
          home_type: profileForOverview.homeType,
          transport_baseline: profileForOverview.transport,
          age,
          employment_status: employmentRaw || undefined,
        }
      : {}
    return buildZoneViewModel({ profile, journeyAnswers })
  }, [profileForOverview, journeyAnswers])

  const [localData, setLocalData] = useState<{ council: string } | null>(null)
  useEffect(() => {
    const postcode = profileForOverview?.postcode?.trim()
    if (!postcode) return
    fetch(`/api/local-intelligence?postcode=${encodeURIComponent(postcode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data?.council ? setLocalData({ council: data.council }) : setLocalData(null)))
      .catch(() => setLocalData(null))
  }, [profileForOverview?.postcode])

  const heroMoney = viewModel?.hero?.data?.money ?? '0'
  const heroCarbonStr = viewModel?.hero?.data?.carbon ?? '0'
  const displayMoneyNum = liveTotals?.savings ?? parseMoneyGbpFromDisplay(heroMoney)
  const carbonNum = liveTotals?.carbon ?? parseCarbonKgFromDisplay(heroCarbonStr)

  const animatedMoney = useCountUp(displayMoneyNum, { duration: 900 })
  const animatedCarbon = useCountUp(carbonNum, { duration: 900 })

  const handleReset = () => {
    clearMachineStorage()
    router.push(ROUTES.INTRO)
    window.location.href = ROUTES.INTRO
  }

  return (
    <motion.div
      className="settings-page"
      style={{
        color: 'var(--color-yellow)',
        minHeight: '100vh',
        position: 'relative',
        paddingTop: 56,
        paddingBottom: 40,
      }}
      {...KINETIC_ZIP_PULSE}
    >
      <ZoneBackToZoneLink />

      {/* Heading centred in the middle (horizontal centre) */}
      <div className="settings-heading-wrap">
        <h1 className="zz-page-title zai-page-title">Settings</h1>
      </div>

      <div className="settings-grid-wrap">
        <section className="settings-hero-section" aria-label="Overview">
          <motion.div
            layout
            className="settings-hero-inner"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          >
            <SettingsBentoCard label="Overview" headline="TOTAL ANNUAL" isHero>
              <div
                className="text-left mt-1 settings-overview-data"
                style={{ color: 'var(--color-yellow)', ['--color-ink' as string]: 'var(--color-yellow)' }}
              >
                <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-0 items-start settings-overview-impact-grid">
                  <span className="data-label text-marvin settings-overview-label">{ENGINE_UI_LABELS.potentialSavings}</span>
                  <span className="data-label text-marvin settings-overview-label">{ENGINE_UI_LABELS.carbon}</span>
                  <span
                    className="data-value text-marvin font-bold settings-data-value data-stamp-metric"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    <StampedMoneyGbp gbp={animatedMoney} />
                  </span>
                  <span
                    className="data-value text-marvin font-bold settings-data-value data-stamp-metric"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    <StampedCarbonKg kg={animatedCarbon} />
                  </span>
                </div>
                {localData?.council && (
                  <p className="settings-council-blurb">{localData.council} initiatives could save you more this year.</p>
                )}
              </div>
            </SettingsBentoCard>
          </motion.div>
        </section>

        <section className="settings-cards-section" aria-label="Profile and journeys">
          <motion.div layout className="settings-answer-grid" transition={SPRING_BLOOM}>
            {profileRows.map((row, i) => (
              <motion.div
                key={`profile-${i}`}
                layout
                className="settings-card-cell"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
              >
                <SettingsBentoCard label={row.question} headline={row.answer} editHref={ROUTES.PROFILE} />
              </motion.div>
            ))}

            {journeyCardsData.map((card) => (
              <motion.div
                key={`journey-${card.journey}`}
                layout
                className="settings-card-cell cursor-pointer"
                onClick={() => setActiveJourneyEdit({ id: card.journey, title: card.title })}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
                whileTap={{ scale: 0.98 }}
              >
                <div
                  className="bento-card-groovy settings-bento-card settings-card-bento settings-journey-card-shell flex flex-col w-full h-full"
                  style={{ backgroundColor: 'var(--color-yellow)', color: 'var(--color-purple)' }}
                >
                  <div className="flex items-center justify-between w-full shrink-0 mb-2">
                    <span className="card-top-label" style={{ color: 'var(--color-purple)' }}>
                      {card.title.toUpperCase()}
                    </span>
                    <div className="card-top-arrow flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, color: 'var(--color-purple)' }} aria-hidden>
                      <PencilIcon />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 settings-journey-answers">
                    {card.answers.map((ans, j) => (
                      <div key={j} className="settings-journey-answer-row">
                        <span className="settings-journey-q">{ans.question}</span>
                        <span className="settings-journey-a">{ans.answer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </div>

      <AnimatePresence>
        {activeJourneyEdit && (
          <SoloFocusOverlay
            key={`edit-${activeJourneyEdit.id}`}
            category={activeJourneyEdit.title}
            recommendation="Edit"
            insight=""
            moneyValue="0"
            carbonValue="0"
            onClose={() => setActiveJourneyEdit(null)}
            journeyId={activeJourneyEdit.id}
            onJourneyAnswered={() => {
              setRefreshKey((k) => k + 1)
              import('@/lib/sessionStateSync').then((m) => m.syncSessionState())
            }}
            startInQuestionMode={true}
          />
        )}
      </AnimatePresence>

      {profileRows.length === 0 && journeyCardsData.length === 0 && (
        <p className="zz-body text-left max-w-[28rem] mx-auto" style={{ color: 'var(--color-yellow)', marginTop: -8, paddingLeft: 20, paddingRight: 20 }}>
          Complete your profile and answer questions in the Zone to see cards here.
        </p>
      )}

      {/* Solid circle CTAs — horizontal row, wrap to second line; label clipped to disc */}
      <div className="settings-cta-circles mt-8 z-10 relative">
        <motion.button
          type="button"
          onClick={() => router.push(ROUTES.ZONE)}
          className="settings-circle-cta settings-circle-cta--yellow"
          whileTap={{ scale: 0.94 }}
          transition={SPRING_TAP}
          aria-label="Save and return to Zone"
        >
          <span className="settings-circle-cta__label zz-h4">SAVE</span>
        </motion.button>
        <Link
          href={ROUTES.PROFILE}
          className="settings-circle-cta settings-circle-cta--yellow"
          aria-label="Update location in profile"
        >
          <span className="settings-circle-cta__label zz-h4">
            UPDATE
            <br />
            LOCATION
          </span>
        </Link>
        <motion.button
          type="button"
          onClick={handleReset}
          className="settings-circle-cta settings-circle-cta--pink"
          whileTap={{ scale: 0.94 }}
          transition={SPRING_TAP}
          aria-label="Reset all data"
        >
          <span className="settings-circle-cta__label zz-h4">
            RESET
            <br />
            DATA
          </span>
        </motion.button>
      </div>
    </motion.div>
  )
}
