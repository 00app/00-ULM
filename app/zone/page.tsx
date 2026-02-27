'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { buildZoneViewModel } from '@/lib/zone/buildZoneViewModel'
import type { ZoneViewModel, ZoneJourneyCard } from '@/lib/zone/buildZoneViewModel'

import { JourneyBentoCard } from '../components/JourneyBentoCard'
import Sheet from '../components/Sheet'
import FloatingNav from '../components/FloatingNav'
import JourneyGrid from '../components/JourneyGrid'
import '../zone.css'

const zoneGridVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 360,
      damping: 28,
      delay: i * 0.045,
    },
  }),
}

const zoneAnchorVariants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 26 },
  },
}

/** First 9 journey cards from viewModel (one per JOURNEY_ORDER) for Neo-Bento grid */
function getJourneyCardsForGrid(viewModel: ZoneViewModel) {
  return viewModel.journeys.slice(0, 9)
}

/** Groovy Grid: order for asymmetrical 60s layout. Long = span 2 (Home, Travel). */
const GROOVY_JOURNEY_ORDER: JourneyId[] = ['carbon', 'home', 'travel', 'food', 'shopping', 'money', 'tech', 'waste', 'holidays']
const GROOVY_LONG_SPAN: Set<JourneyId> = new Set(['home', 'travel'])

type GroovyItem =
  | { type: 'hero'; span: 2; hero: ZoneViewModel['hero'] }
  | { type: 'pulse'; span: 1; localCarbonG: number }
  | { type: 'journey'; span: 1 | 2; item: ZoneJourneyCard }

function getGroovyGridItems(
  viewModel: ZoneViewModel,
  localCarbonG?: number
): GroovyItem[] {
  const byId = new Map(viewModel.journeys.map((j) => [j.journey_key, j]))
  const items: GroovyItem[] = [{ type: 'hero', span: 2, hero: viewModel.hero }]
  if (localCarbonG != null) {
    items.push({ type: 'pulse', span: 1, localCarbonG })
  }
  for (const jid of GROOVY_JOURNEY_ORDER) {
    const item = byId.get(jid)
    if (!item) continue
    const span = GROOVY_LONG_SPAN.has(jid) ? 2 : 1
    items.push({ type: 'journey', span, item })
  }
  return items
}

export default function ZonePage() {
  const router = useRouter()
  const { state, toggleLike } = useApp()

  const [viewModel, setViewModel] = useState<ZoneViewModel | null>(null)
  const [completedJourneys, setCompletedJourneys] = useState<JourneyId[]>([])
  const [sheetCard, setSheetCard] = useState<ZoneJourneyCard | null>(null)
  const [scraped, setScraped] = useState<Record<JourneyId, { scraped_at: string; carbon_value: number; money_value: number; deep_content_tip?: string; high_saving?: boolean }> | null>(null)
  const [localData, setLocalData] = useState<{ council: string; region: string; localCarbonG?: number; ward?: string } | null>(null)
  const [localJustLoaded, setLocalJustLoaded] = useState(false)
  /** Kinetic Bento: which journey card is expanded in-grid (push-aside reflow). */
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  // Local Living: fetch council + regional carbon when user has postcode (Postcodes.io + Carbon Intensity API)
  useEffect(() => {
    const postcode = state.profile?.postcode?.replace(/\s+/g, '').trim()
    if (!postcode || postcode.length < 4) {
      setLocalData(null)
      return
    }
    fetch(`/api/local-intelligence?postcode=${encodeURIComponent(postcode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.council) {
          setLocalData({ council: data.council, region: data.region ?? data.council, localCarbonG: data.localCarbonG, ward: data.ward })
          setLocalJustLoaded(true)
        }
      })
      .catch(() => {})
  }, [state.profile?.postcode])

  useEffect(() => {
    if (!localJustLoaded) return
    const t = setTimeout(() => setLocalJustLoaded(false), 1200)
    return () => clearTimeout(t)
  }, [localJustLoaded])

  // Load scraped data from API so dashboard hero values use £/yr from 001 Crawler
  useEffect(() => {
    fetch('/api/scrape-sync')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.scraped && Array.isArray(data.scraped)) {
          const map: Record<string, { scraped_at: string; carbon_value: number; money_value: number; deep_content_tip?: string; high_saving?: boolean }> = {}
          data.scraped.forEach((s: any) => {
            map[s.journey_key] = {
              scraped_at: s.scraped_at,
              carbon_value: s.carbon_value,
              money_value: s.money_value,
              deep_content_tip: s.deep_content_tip,
              high_saving: s.high_saving,
            }
          })
          setScraped(map as Record<JourneyId, { scraped_at: string; carbon_value: number; money_value: number; deep_content_tip?: string; high_saving?: boolean }>)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const storedCompleted: JourneyId[] =
      JSON.parse(localStorage.getItem('completedJourneys') || '[]')
    setCompletedJourneys(storedCompleted)
    const journeyAnswers: Record<JourneyId, Record<string, string>> = {} as Record<
      JourneyId,
      Record<string, string>
    >
    JOURNEY_ORDER.forEach((journeyId) => {
      const stored = localStorage.getItem(`journey_${journeyId}_answers`)
      if (stored) journeyAnswers[journeyId] = JSON.parse(stored)
    })
    const vm = buildZoneViewModel({
      profile: {
        name: state.profile?.name,
        postcode: state.profile?.postcode,
        household: state.profile?.livingSituation,
        home_type: state.profile?.homeType,
        transport_baseline: state.profile?.transport,
        age: state.profile?.age,
      },
      journeyAnswers,
      scraped: scraped ? Object.fromEntries(
        Object.entries(scraped).map(([k, v]) => [
          k,
          { journey_key: k as JourneyId, scraped_at: v.scraped_at, carbon_value: v.carbon_value, money_value: v.money_value, deep_content_tip: v.deep_content_tip, high_saving: v.high_saving },
        ])
      ) : undefined,
      localData: localData ? { council: localData.council, localCarbonG: localData.localCarbonG } : undefined,
    })
    setViewModel(vm)
  }, [state.profile, scraped, localData])

  if (!viewModel) {
    const emptyAnswers = {} as Record<JourneyId, Record<string, string>>
    const fallbackVm = buildZoneViewModel({ profile: {}, journeyAnswers: emptyAnswers })
    setViewModel(fallbackVm)
    return null
  }

  const journeyCardsForGrid = getJourneyCardsForGrid(viewModel)
  const groovyItems = getGroovyGridItems(viewModel, localData?.localCarbonG)

  return (
    <main className="zone">
      {/* Physical UI — Anchor: LESS MORE (left), Logo (center), Ask Zai (below) */}
      <motion.div
        className="zone-anchor"
        variants={zoneAnchorVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="zone-menu" aria-hidden>LESS MORE</div>
        <div className="zone-logo">
          <svg width="51" height="auto" viewBox="0 0 126 200" fill="none" style={{ width: '100%', height: 'auto' }}>
            <path d="M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z" fill="var(--color-blue)" />
            <path d="M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z" fill="var(--color-blue)" />
            <path d="M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411" fill="var(--color-blue)" />
          </svg>
        </div>
        <div className="zone-ask-zai-wrap">
          <input
            type="text"
            className="zone-ask-zai-pill"
            placeholder="Ask Zai"
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push('/zai')
            }}
            onFocus={() => {}}
          />
        </div>
      </motion.div>

      {/* Kinetic Bento Grid — layout + layoutId for push-aside reflow; expanded card stays in grid */}
      <div className="zone-container">
        <motion.div
          layout
          className={`groovy-zone-grid ${localJustLoaded ? 'zone-grid-local-shiver' : ''}`}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          {groovyItems.map((cell, i) => {
            const cellKey = cell.type === 'hero' ? 'hero' : cell.type === 'pulse' ? 'pulse' : cell.item.id
            const isExpanded = cell.type === 'journey' && expandedCardId === cell.item.id
            return (
            <motion.div
              key={cellKey}
              layout
              layoutId={`kinetic-cell-${cellKey}`}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`${cell.span === 2 ? 'groovy-span-2' : 'groovy-span-1'} ${isExpanded ? 'card-expanded' : ''}`}
            >
              {cell.type === 'hero' && (
                <motion.div
                  className="bento-card-groovy relative flex flex-col justify-end cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-atomic-orange)',
                    minHeight: 120,
                  }}
                  whileTap={{ scale: 0.92, rotate: -1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <span className="zone-card-number hero-total block" style={{ color: 'var(--color-burnt)' }}>
                    {cell.hero.data.money}
                  </span>
                  <span className="zone-card-unit text-sm opacity-90" style={{ color: 'var(--color-burnt)' }}>{cell.hero.data.carbon} / yr</span>
                </motion.div>
              )}
              {cell.type === 'pulse' && (
                <motion.div
                  className={`bento-card-groovy relative flex flex-col justify-end cursor-default ${localData?.localCarbonG != null && localData.localCarbonG < 50 ? 'grid-pulse--low-carbon' : ''}`}
                  style={{
                    backgroundColor: 'var(--color-turquoise)',
                    minHeight: 100,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <span className="zone-card-unit text-xs uppercase" style={{ color: 'var(--color-burnt)' }}>Live grid</span>
                  <span className="zone-card-number text-3xl block" style={{ color: 'var(--color-burnt)', fontFamily: 'var(--font-label)' }}>
                    {cell.localCarbonG} gCO₂/kWh
                  </span>
                </motion.div>
              )}
              {cell.type === 'journey' && (
                <JourneyBentoCard
                  journeyId={cell.item.journey_key}
                  title={cell.item.title}
                  carbonValue={cell.item.data.carbon}
                  moneyValue={cell.item.data.money}
                  carbonKg={cell.item.carbonKg}
                  moneyGbp={cell.item.moneyGbp}
                  isComplete={completedJourneys.includes(cell.item.journey_key)}
                  onRefineQuestions={(id) => router.push(`/journeys/${id}`)}
                  onActionClick={() => setSheetCard(cell.item)}
                  crawlerTip={cell.item.localCouncilTip || cell.item.insightLabel || cell.item.explanation?.[0]}
                  insightLabel={cell.item.insightLabel}
                  insightAlert={cell.item.insightAlert}
                  fromScraper={cell.item.fromScraper}
                  showLocalTag={!!localData?.council && (cell.item.journey_key === 'home' || cell.item.journey_key === 'travel')}
                  localCarbonG={cell.item.journey_key === 'carbon' ? localData?.localCarbonG : undefined}
                  hasLocalGrant={cell.item.journey_key === 'home' && !!localData?.council}
                  localContextBar={localData?.council ? `In ${localData.council}, you are currently eligible for the Boiler Upgrade Scheme (£7,500). Your local grid is running at ${localData.localCarbonG ?? '—'}g CO₂e/kWh—it's a 'Green' window to charge your tech.` : undefined}
                  claimOfferUrl={cell.item.claimOfferUrl}
                  isPriorityAlert={cell.item.isPriorityAlert}
                  groovy
                  kineticGrid
                  isExpanded={isExpanded}
                  onExpand={() => setExpandedCardId(cell.item.id)}
                  onClose={() => setExpandedCardId(null)}
                  cardId={cell.item.id}
                  onLike={toggleLike}
                  isLiked={state.likedCards.includes(cell.item.id)}
                  learnUrl={cell.item.actions?.learnUrl}
                />
              )}
            </motion.div>
            )
          })}
        </motion.div>
      </div>

      {/* Journey progression below bento */}
      <div className="zone-incomplete-wrapper" style={{ marginTop: 40 }}>
        <div className="incomplete-container">
          <h4 className="incomplete-label">explore more.</h4>
          <JourneyGrid
            completedJourneys={completedJourneys}
            onJourneyClick={(id) => router.push(`/journeys/${id}`)}
            showLabel={false}
          />
        </div>
      </div>

      <Sheet
        isOpen={!!sheetCard}
        onClose={() => setSheetCard(null)}
        data={sheetCard ? {
          id: sheetCard.id,
          title: sheetCard.title,
          journey: sheetCard.journey_key,
          data: { money: sheetCard.data.money, carbon: sheetCard.data.carbon },
          source: sheetCard.source,
          sourceLabel: sheetCard.sourceLabel,
          body: sheetCard.localCouncilTip
            ? [sheetCard.localCouncilTip, ...(sheetCard.explanation ?? [])]
            : sheetCard.explanation,
          actions: sheetCard.actions ? {
            actionType: sheetCard.actions.actionType,
            learnUrl: sheetCard.actions.learnUrl,
            actionUrl: sheetCard.actions.actionUrl,
          } : undefined,
        } : undefined}
        isJourneyComplete={sheetCard ? completedJourneys.includes(sheetCard.journey_key) : false}
      />

      <FloatingNav
        active="zone"
        hasNewTipForZai={!!(scraped && Object.keys(scraped).length > 0)}
        onNavigate={(key) => {
          if (key === 'likes') router.push('/likes')
          if (key === 'zone') router.push('/zone')
          if (key === 'summary') router.push('/settings')
          if (key === 'chat') router.push('/zai')
        }}
      />
    </main>
  )
}
