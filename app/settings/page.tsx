'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import { useRouter } from 'next/navigation'
import { useApp, type ProfileAge } from '@/app/context/AppContext'
import { motion } from 'framer-motion'
import { JOURNEY_ORDER, JOURNEYS, getOptionFullLabel, type JourneyId } from '@/lib/journeys'
import { readLoopAnswersForSettings } from '@/lib/zone/loopQuestions'
import { readOfferFeedbackForSettings } from '@/lib/zone/offerFeedbackLoop'
import { ROUTES } from '@/lib/routes'
import { ENGINE_UI_LABELS } from '@/lib/logic/engine'
import {
  FAMILY_DUR_SHORT,
  FAMILY_EASE,
  FAMILY_PAGE_ENTER,
  familyAtomicProps,
  familyPageEnterProps,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { SettingsLoopEditOverlay } from '@/app/components/SettingsLoopEditOverlay'
import { SettingsJourneyEditOverlay } from '@/app/components/SettingsJourneyEditOverlay'
import type { LoopAnswerSettingsRow } from '@/lib/zone/loopQuestions'
import { buildZoneViewModel } from '@/lib/logic/zone'
import { useCountUp } from '@/lib/utils/useCountUp'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { UNIFIED_PROFILE_MEMORY_EVENT } from '@/lib/unifiedProfileMemory'
import { ResetDataCircleButton } from '@/app/components/ResetDataCircleButton'
import SettingsBentoCard, { SettingsJourneyFactRow, useSettingsCardVisited } from '@/app/components/SettingsBentoCard'
import SettingsProfileGoalRow from '@/app/components/SettingsProfileGoalRow'
import { readEffectiveProfileGoal } from '@/lib/profile/profileGoalPreference'

const PROFILE_STORAGE_KEYS = {
  name: 'name',
  postcode: 'postcode',
  livingSituation: 'livingSituation',
  homeType: 'homeType',
  transport: 'transport',
  age: 'age',
  employmentStatus: 'employmentStatus',
  homePower: 'homePower',
} as const

type ProfileStorageKey = keyof typeof PROFILE_STORAGE_KEYS

const PROFILE_FIELD_META: Array<{
  id: string
  storageKey: ProfileStorageKey
  aria: string
}> = [
  { id: 'name', storageKey: 'name', aria: 'Name' },
  { id: 'postcode', storageKey: 'postcode', aria: 'Postcode' },
  { id: 'livingSituation', storageKey: 'livingSituation', aria: 'Household' },
  { id: 'homeType', storageKey: 'homeType', aria: 'Home type' },
  { id: 'transport', storageKey: 'transport', aria: 'Transport' },
  { id: 'age', storageKey: 'age', aria: 'Age' },
  { id: 'employmentStatus', storageKey: 'employmentStatus', aria: 'Employment' },
  { id: 'homePower', storageKey: 'homePower', aria: 'Home power' },
]

function formatProfilePreviewValue(key: ProfileStorageKey, raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  if (key === 'name' || key === 'postcode') return v
  return getOptionFullLabel(v)
}

/** Pin drop — Update location */
function PinIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/** Tick — Save */
function TickIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const ICON_SIZE = 44

function PencilIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

type JourneyCardData = { journey: JourneyId; title: string; answers: { question: string; answer: string }[] }

/** Deep blue until opened, pink once visited — same rollover as Zone bento cards. */
function SettingsJourneyCard({
  card,
  onOpen,
}: {
  card: JourneyCardData
  onOpen: () => void
}) {
  const [visited, markVisited] = useSettingsCardVisited(`settings-journey-${card.journey}`)
  return (
    <div
      className="bento-card-groovy settings-bento-card settings-card-bento settings-journey-card-shell flex flex-col justify-between w-full h-full"
      style={{
        backgroundColor: visited ? 'var(--color-pink)' : 'var(--color-purple)',
        color: 'var(--color-yellow)',
      }}
      onClick={() => {
        markVisited()
        onOpen()
      }}
    >
      <div className="flex items-center justify-between w-full shrink-0">
        <span className="card-top-label">{card.title}</span>
        <div className="card-top-arrow card-top-arrow--action flex items-center justify-center flex-shrink-0" aria-hidden>
          <PencilIcon />
        </div>
      </div>
      <div className="flex flex-col gap-2 settings-journey-answers">
        {card.answers.map((ans, idx) => (
          <SettingsJourneyFactRow key={`${card.journey}-${idx}`} label={ans.question} value={ans.answer} />
        ))}
      </div>
    </div>
  )
}

/** Pin drop — Update location */
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
  const reduceMotion = useHydrationSafeReducedMotion()
  const settingsCellMotion = familyAtomicProps(reduceMotion)
  const pageEnter = familyPageEnterProps(reduceMotion)
  const settingsStaggerTransition = reduceMotion
    ? { duration: 0.12, ease: 'linear' as const }
    : { duration: FAMILY_DUR_SHORT, ease: FAMILY_EASE }
  const [hasMounted, setHasMounted] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeJourneyEdit, setActiveJourneyEdit] = useState<{ id: JourneyId; title: string } | null>(null)
  const [activeLoopEdit, setActiveLoopEdit] = useState<LoopAnswerSettingsRow | null>(null)
  const [truthLedgerVisited, markTruthLedgerVisited] = useSettingsCardVisited('settings-truth-ledger')

  useEffect(() => setHasMounted(true), [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMemory = () => setRefreshKey((k) => k + 1)
    window.addEventListener(UNIFIED_PROFILE_MEMORY_EVENT, onMemory)
    window.addEventListener('profile-goal-changed', onMemory)
    return () => {
      window.removeEventListener(UNIFIED_PROFILE_MEMORY_EVENT, onMemory)
      window.removeEventListener('profile-goal-changed', onMemory)
    }
  }, [])

  const profileForOverview = useMemo(() => {
    void refreshKey
    const p = state.profile
    if (p) {
      const homePower =
        p.homePower?.trim() ||
        (typeof window !== 'undefined' && hasMounted ? localStorage.getItem('profile_home_power') ?? '' : '')
      const employmentStatus =
        p.employmentStatus?.trim() ||
        (typeof window !== 'undefined' && hasMounted ? localStorage.getItem('profile_employment_status') ?? '' : '')
      return { ...p, homePower, employmentStatus }
    }
    if (typeof window === 'undefined' || !hasMounted) return null
    const name = localStorage.getItem('profile_name') ?? ''
    const postcode = localStorage.getItem('profile_postcode') ?? ''
    const livingSituation = localStorage.getItem('profile_household') ?? ''
    const homeType = localStorage.getItem('profile_home_type') ?? ''
    const transport = localStorage.getItem('profile_transport') ?? ''
    const age = localStorage.getItem('profile_age') ?? ''
    if (!name && !postcode) return null
    const employmentStatus = localStorage.getItem('profile_employment_status') ?? ''
    const homePower = localStorage.getItem('profile_home_power') ?? ''
    return { name, postcode, livingSituation, homeType, transport, age, employmentStatus, homePower }
  }, [state.profile, hasMounted, refreshKey])

  const profileRows = useMemo(() => {
    if (!profileForOverview) return []
    const map = {
      name: profileForOverview.name ?? '',
      postcode: profileForOverview.postcode ?? '',
      livingSituation: profileForOverview.livingSituation ?? '',
      homeType: profileForOverview.homeType ?? '',
      transport: profileForOverview.transport ?? '',
      age: profileForOverview.age ?? '',
      employmentStatus: profileForOverview.employmentStatus ?? '',
      homePower: profileForOverview.homePower ?? '',
    }
    return PROFILE_FIELD_META.flatMap(({ id, storageKey, aria }) => {
      const raw = map[storageKey]?.trim()
      if (!raw) return []
      const answer = formatProfilePreviewValue(storageKey, raw)
      if (!answer) return []
      return [{ id, aria, answer }]
    })
  }, [profileForOverview])

  const loopRows = useMemo(() => {
    void refreshKey
    if (!hasMounted) return []
    return readLoopAnswersForSettings()
  }, [hasMounted, refreshKey])

  const offerFeedbackRows = useMemo(() => {
    void refreshKey
    if (!hasMounted) return []
    return readOfferFeedbackForSettings()
  }, [hasMounted, refreshKey])

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
          if (v) answers.push({ question: SHORT_QUESTION_LABELS[q.id] || q.label, answer: getOptionFullLabel(v) })
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
          goal: readEffectiveProfileGoal(),
        }
      : { goal: readEffectiveProfileGoal() }
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

  /** Same engine totals as Zone hero — profile + journey-answer waste, not welcome “potential”. */
  const displayMoneyNum = parseMoneyGbpFromDisplay(viewModel?.hero?.data?.money ?? '0')
  const carbonNum = parseCarbonKgFromDisplay(viewModel?.hero?.data?.carbon ?? '0')

  const animatedMoney = useCountUp(displayMoneyNum, { duration: 900 })
  const animatedCarbon = useCountUp(carbonNum, { duration: 900 })

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

      {/* Page title — H3, left-aligned (matches Ask Zai / Likes) */}
      <div className="settings-heading-wrap">
        <h3 className="zz-page-title">Settings</h3>
      </div>

      <div className="settings-grid-wrap">
        <section className="settings-hero-section" aria-label="Overview">
          <motion.div
            className="settings-hero-inner"
            initial={settingsCellMotion.initial}
            animate={settingsCellMotion.animate}
            transition={{ ...settingsStaggerTransition, delay: 0.08 }}
          >
            <SettingsBentoCard label="Overview" headline="YOUR ANNUAL WASTE" isHero>
              <div
                className="text-left mt-1 settings-overview-data"
                style={{ color: 'var(--color-yellow)', ['--color-ink' as string]: 'var(--color-yellow)' }}
              >
                <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-0 items-start settings-overview-impact-grid">
                  <span className="data-label text-marvin settings-overview-label">{ENGINE_UI_LABELS.profileWasteMoney}</span>
                  <span className="data-label text-marvin settings-overview-label">{ENGINE_UI_LABELS.profileWasteCarbon}</span>
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
                  <h4 className="settings-council-blurb">
                    {localData.council} initiatives could save you more this year.
                  </h4>
                )}
              </div>
            </SettingsBentoCard>
          </motion.div>
        </section>

        <section className="settings-cards-section settings-cards-section--focus" aria-label="Your focus">
          <motion.div
            className="settings-answer-grid"
            initial={settingsCellMotion.initial}
            animate={settingsCellMotion.animate}
            transition={{ ...settingsStaggerTransition, delay: 0.09 }}
          >
            <motion.div className="settings-card-cell settings-card-cell--wide">
              <SettingsProfileGoalRow onChange={() => setRefreshKey((k) => k + 1)} />
            </motion.div>
          </motion.div>
        </section>

        <section className="settings-hero-section settings-truth-section" aria-label="Truth ledger">
          <motion.div
            className="settings-hero-inner"
            initial={settingsCellMotion.initial}
            animate={settingsCellMotion.animate}
            transition={{ ...settingsStaggerTransition, delay: 0.1 }}
          >
            <Link
              href={ROUTES.SETTINGS_TRUTH}
              onClick={markTruthLedgerVisited}
              className="bento-card-groovy settings-bento-card settings-truth-link flex flex-col justify-between w-full no-underline"
              style={{
                backgroundColor: truthLedgerVisited ? 'var(--color-pink)' : 'var(--color-purple)',
                color: 'var(--color-yellow)',
              }}
            >
              <span className="card-top-label">Source of truth</span>
              <h3 className="card-headline m-0">TRUTH LEDGER</h3>
            </Link>
          </motion.div>
        </section>

        <section className="settings-cards-section settings-cards-section--profile" aria-label="Profile and journeys">
          <motion.div className="settings-answer-grid" transition={settingsStaggerTransition}>
            {profileRows.map((row, i) => (
              <motion.div
                key={`profile-${i}`}
                className="settings-card-cell"
                initial={settingsCellMotion.initial}
                animate={settingsCellMotion.animate}
                transition={{ ...settingsStaggerTransition, delay: 0.05 + i * 0.08 }}
              >
                <SettingsBentoCard
                  label={row.aria}
                  headline={row.answer}
                  hideLabel
                  editHref={`${ROUTES.PROFILE}?q=${encodeURIComponent(row.id)}&returnTo=${encodeURIComponent(ROUTES.SETTINGS)}`}
                  cardId={`settings-profile-${row.id}`}
                />
              </motion.div>
            ))}

            {loopRows.map((row, i) => (
              <motion.div
                key={`loop-${row.questionId}`}
                className="settings-card-cell"
                initial={settingsCellMotion.initial}
                animate={settingsCellMotion.animate}
                transition={{
                  ...settingsStaggerTransition,
                  delay: 0.05 + (profileRows.length + i) * 0.08,
                }}
              >
                <SettingsBentoCard
                  label={row.question}
                  headline={row.answer}
                  hideLabel
                  onEditClick={() => setActiveLoopEdit(row)}
                  cardId={`settings-loop-${row.questionId}`}
                />
              </motion.div>
            ))}

            {offerFeedbackRows.map((row, i) => (
              <motion.div
                key={`offer-feedback-${row.id}`}
                className="settings-card-cell"
                initial={settingsCellMotion.initial}
                animate={settingsCellMotion.animate}
                transition={{
                  ...settingsStaggerTransition,
                  delay: 0.05 + (profileRows.length + loopRows.length + i) * 0.08,
                }}
              >
                <SettingsBentoCard label={row.label} headline={row.headline} hideLabel cardId={`settings-offer-${row.id}`} />
              </motion.div>
            ))}

            {journeyCardsData.map((card, j) => (
              <motion.div
                key={`journey-${card.journey}`}
                className="settings-card-cell cursor-pointer"
                initial={settingsCellMotion.initial}
                animate={settingsCellMotion.animate}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                transition={{
                  ...settingsStaggerTransition,
                  delay: 0.05 + (profileRows.length + loopRows.length + offerFeedbackRows.length + j) * 0.08,
                }}
              >
                <SettingsJourneyCard
                  card={card}
                  onOpen={() => setActiveJourneyEdit({ id: card.journey, title: card.title })}
                />
              </motion.div>
            ))}
          </motion.div>
        </section>
      </div>

      <>
        {activeLoopEdit ? (
          <SettingsLoopEditOverlay
            row={activeLoopEdit}
            onClose={() => setActiveLoopEdit(null)}
          />
        ) : null}

        {activeJourneyEdit ? (
          <SettingsJourneyEditOverlay
            journeyId={activeJourneyEdit.id}
            title={activeJourneyEdit.title}
            onClose={() => setActiveJourneyEdit(null)}
          />
        ) : null}
      </>

      {profileRows.length === 0 && loopRows.length === 0 && journeyCardsData.length === 0 && (
        <h4 className="zz-h4 text-center max-w-[28rem] w-full mx-auto m-0 mt-2" style={{ color: 'var(--color-yellow)' }}>
          Complete your profile, answer journey questions, and close Solo Focus loop beats in the Zone to see cards here.
        </h4>
      )}

      {/* Solid circle CTAs — horizontal row, wrap to second line; label clipped to disc */}
      <div className="settings-cta-circles settings-cta-circles--tight z-10 relative">
        <motion.button
          type="button"
          onClick={() => router.push(ROUTES.ZONE)}
          className="settings-circle-cta settings-circle-cta--yellow"
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          transition={settingsStaggerTransition}
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
        <ResetDataCircleButton />
      </div>
    </motion.div>
  )
}
