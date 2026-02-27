'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { JourneyId } from '@/lib/journeys'

export interface JourneyBentoCardProps {
  journeyId: JourneyId
  title: string
  carbonValue: string
  moneyValue: string
  /** For Economic-First lead logic: which metric is the "hero" (bigger hook) */
  carbonKg?: number
  moneyGbp?: number
  isComplete?: boolean
  onRefineQuestions?: (journeyId: JourneyId) => void
  /** Opens Sheet for deeper journey questions (80px Action Core) */
  onActionClick?: (journeyId: JourneyId) => void
  /** Latest scraped tip from 001 Crawler (expanded state) */
  crawlerTip?: string
  insightLabel?: string
  insightAlert?: boolean
  fromScraper?: boolean
  /** Local Living: show "Local" tag in corner (Home + Travel when council set) */
  showLocalTag?: boolean
  /** Local Living: real-time regional gCO₂/kWh for Carbon card */
  localCarbonG?: number
  /** Local Living: pulse 80px circle green when council has local grant (Home) */
  hasLocalGrant?: boolean
  /** S Update: Local Context Bar text (council + Boiler Upgrade + grid gCO₂). Rendered 40px below Hero. */
  localContextBar?: string
  /** S Update: URL for "Claim Offer" CTA (GOV.UK or council application). */
  claimOfferUrl?: string
  /** S Update: when true (e.g. Warm Homes eligible), card gets pulsing gold border. */
  isPriorityAlert?: boolean
  /** 60s Groovy Grid: massive radius, bouncy spring, twist on press. */
  groovy?: boolean
  /** Kinetic Bento: expand in-grid (push-aside reflow); parent controls expansion. */
  kineticGrid?: boolean
  /** Kinetic: expanded state from parent. */
  isExpanded?: boolean
  /** Kinetic: called when card is tapped (collapsed) to expand. */
  onExpand?: () => void
  /** Kinetic: called when Close or background is tapped to collapse. */
  onClose?: () => void
  /** Card id for like toggle (Trinity: Like 80px circle). */
  cardId?: string
  /** Toggle like (Save for Later). */
  onLike?: (id: string) => void
  /** Whether this card is liked. */
  isLiked?: boolean
  /** Learn more URL (Trinity: Learn 80px circle). */
  learnUrl?: string
}

const FLIP_INTERVAL_MS = 5000

/** Economic-First: lead with the bigger "win" (money vs carbon). Compare normalized. */
function getLeadMetric(moneyGbp: number, carbonKg: number): 'money' | 'carbon' {
  if (moneyGbp === 0 && carbonKg === 0) return 'carbon'
  return moneyGbp / 100 >= carbonKg / 100 ? 'money' : 'carbon'
}

/** Proportional Impact: money share of card height (0–1). Top = money, bottom = carbon. */
function getMoneyShare(moneyGbp: number, carbonKg: number): number {
  const m = Math.max(0, moneyGbp)
  const c = Math.max(0, carbonKg)
  if (m + c === 0) return 0.5
  return m / (m + c)
}

export function JourneyBentoCard({
  journeyId,
  title,
  carbonValue,
  moneyValue,
  carbonKg = 0,
  moneyGbp = 0,
  isComplete = false,
  onRefineQuestions,
  onActionClick,
  crawlerTip,
  insightLabel,
  insightAlert = false,
  fromScraper = false,
  showLocalTag = false,
  localCarbonG,
  hasLocalGrant = false,
  localContextBar,
  claimOfferUrl,
  isPriorityAlert = false,
  groovy = false,
  kineticGrid = false,
  isExpanded = false,
  onExpand,
  onClose,
  cardId,
  onLike,
  isLiked = false,
  learnUrl,
}: JourneyBentoCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [displayPrimary, setDisplayPrimary] = useState(true) // true = show lead metric, false = show secondary
  const [slotValue, setSlotValue] = useState(0) // rolls 0 → primaryNumeric when card expands
  const color = `var(--color-j-${journeyId})`
  /** Kinetic: parent controls. Non-kinetic: internal isOpen. */
  const effectiveOpen = kineticGrid ? isExpanded : isOpen
  const lead = getLeadMetric(moneyGbp, carbonKg)
  const primaryNumeric = lead === 'money' ? moneyGbp : carbonKg
  const primaryValue = lead === 'money' ? moneyValue : carbonValue
  const secondaryValue = lead === 'money' ? carbonValue : moneyValue
  const primaryUnit = lead === 'money' ? '/ yr' : 'kg CO₂e / yr'
  const secondaryUnit = lead === 'money' ? 'kg CO₂e / yr' : '/ yr'

  // Flip only when NOT in kinetic grid (spec: single stable view per card — money + carbon together, no bouncing)
  useEffect(() => {
    if (kineticGrid) return
    const t = setInterval(() => setDisplayPrimary((p) => !p), FLIP_INTERVAL_MS)
    return () => clearInterval(t)
  }, [kineticGrid])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (kineticGrid) onClose?.()
        else setIsOpen(false)
      }
    }
    if (effectiveOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [effectiveOpen, kineticGrid, onClose])

  // Slot-machine: roll from 0 to primaryNumeric when card expands
  useEffect(() => {
    if (!effectiveOpen) {
      setSlotValue(0)
      return
    }
    const target = Math.max(0, Math.round(primaryNumeric))
    const duration = 600
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - (1 - t) * (1 - t) // easeOutQuad
      setSlotValue(Math.round(eased * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [effectiveOpen, primaryNumeric])

  const handleActionCircle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!kineticGrid) setIsOpen(false)
    onActionClick?.(journeyId)
  }

  const spring = { type: 'spring' as const, stiffness: 360, damping: 26 }
  const squishBounce = { type: 'spring' as const, stiffness: 600, damping: 15 }
  /** S Update: unified Bloom & Reflow — 60s snap */
  const groovySpring = { type: 'spring' as const, stiffness: 500, damping: 30, mass: 1 }
  const snapSpring = groovySpring
  /** Squish-effect for 80px buttons: physical displacement */
  const squishEffect = {
    whileTap: { scaleX: 1.15, scaleY: 0.85 },
    transition: { type: 'spring' as const, stiffness: 600, damping: 15 },
  }
  const stagger = { delay: 0.2, delayCarbon: 0.3, delayTip: 0.45 }

  const triggerHaptic = (pattern: 'light' | 'medium' | 'heavy') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (pattern === 'heavy') navigator.vibrate(25)
      else if (pattern === 'medium') navigator.vibrate(15)
      else navigator.vibrate(5)
    }
  }

  const displayedValue = displayPrimary ? primaryValue : secondaryValue
  const displayedUnit = displayPrimary ? primaryUnit : secondaryUnit

  /** Kinetic: collapsed = journey color bg + white text; expanded = white bg + journey color text */
  const collapsedLabelStyle = kineticGrid ? { color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.2)' } : undefined
  const expandedTextStyle = kineticGrid ? { color } : { color: 'var(--color-burnt)' }

  // Kinetic Grid: expanded — Reverse-Out (white bg, journey color text) + Deep Content Stack + Trinity
  if (kineticGrid && effectiveOpen) {
    return (
      <motion.div
        layout
        layoutId={`card-${journeyId}`}
        className="relative w-full min-h-full flex flex-col rounded-[48px] overflow-auto bg-white p-6 md:p-8"
        style={{ borderRadius: 48 }}
        transition={groovySpring}
        initial={false}
        onAnimationComplete={() => triggerHaptic('light')}
      >
        <motion.button
          type="button"
          aria-label="Close"
          onClick={(e) => { e.stopPropagation(); triggerHaptic('medium'); onClose?.() }}
          className="action-circle-80 absolute top-6 right-6 z-10 flex items-center justify-center bg-black text-white rounded-full"
          style={{ width: 80, height: 80 }}
          {...squishEffect}
        >
          <span className="text-3xl font-black leading-none select-none" style={{ marginTop: -2 }}>×</span>
        </motion.button>

        <motion.h1 layoutId={`title-${journeyId}`} className="uppercase text-2xl mb-6 font-black" style={expandedTextStyle}>
          {journeyId}
        </motion.h1>

        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full overflow-auto px-4 pb-8">
          {/* Top Hero: Proportional Win (£ and kg) — H1 Marvin Visions */}
          <motion.div
            layoutId={`data-container-${journeyId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.2 }}
            className="text-center"
          >
            <span className="hero-total block leading-none font-black" style={{ fontFamily: 'var(--font-label)', ...expandedTextStyle }}>
              {moneyValue}
            </span>
            <span className="block mt-1 text-lg font-bold zz-label" style={expandedTextStyle}>/ yr</span>
            <span className="hero-total block leading-none font-black mt-4" style={{ fontFamily: 'var(--font-label)', fontSize: 'clamp(48px, 12vw, 90px)', ...expandedTextStyle }}>
              {carbonValue}
            </span>
            <span className="block mt-1 text-lg font-bold zz-label" style={expandedTextStyle}>kg CO₂e / yr</span>
          </motion.div>

          {/* Middle (40px down): Scraped Offer / Local Tip — BODY Roboto 400 */}
          {(localContextBar || crawlerTip || insightLabel) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="w-full text-center zz-body"
              style={{ marginTop: 40, fontFamily: 'Roboto', fontWeight: 400, fontSize: 18, ...expandedTextStyle }}
            >
              <p className="m-0">{localContextBar || crawlerTip || insightLabel}</p>
            </motion.div>
          )}

          {/* Action Row: Trinity of 80px circles — ACTION (BLUE), LIKE (ICE + heart), LEARN (COOL) */}
          <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic('heavy')
                if (claimOfferUrl) window.open(claimOfferUrl, '_blank')
                handleActionCircle(e)
              }}
              className="action-circle-80 flex items-center justify-center rounded-full border-0 font-black uppercase text-[10px] tracking-widest text-white"
              style={{ width: 80, height: 80, background: hasLocalGrant ? 'var(--color-j-food)' : 'var(--color-blue)' }}
              {...squishEffect}
            >
              {claimOfferUrl ? 'Claim' : 'Go'}
            </motion.button>
            {cardId && onLike && (
              <motion.button
                type="button"
                aria-label={isLiked ? 'Unlike' : 'Save for later'}
                onClick={(e) => { e.stopPropagation(); triggerHaptic('medium'); onLike(cardId) }}
                className="action-circle-80 flex items-center justify-center rounded-full border-0"
                style={{ width: 80, height: 80, background: 'var(--color-ice)', color: 'var(--color-blue)' }}
                {...squishEffect}
              >
                <svg width="28" height="26" viewBox="0 0 24 22" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </motion.button>
            )}
            {learnUrl && (
              <motion.button
                type="button"
                aria-label="Learn more"
                onClick={(e) => { e.stopPropagation(); window.open(learnUrl, '_blank') }}
                className="action-circle-80 flex items-center justify-center rounded-full border-0 font-black uppercase text-[10px] tracking-widest"
                style={{ width: 80, height: 80, background: 'var(--color-cool)', color: 'var(--color-blue)' }}
                {...squishEffect}
              >
                Learn
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  const moneyShare = getMoneyShare(moneyGbp, carbonKg)
  const whiteLabel = { color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontFamily: 'var(--font-label)' as const }

  return (
    <>
      <motion.div
        layout
        layoutId={`card-${journeyId}`}
        onClick={kineticGrid ? () => onExpand?.() : () => setIsOpen(true)}
        className={`relative cursor-pointer overflow-hidden ${groovy ? 'bento-card-groovy' : 'bento-card-clean'} ${insightAlert ? 'insight-alert' : ''} ${isPriorityAlert ? 'bento-card-priority-alert' : ''}`}
        style={{
          borderRadius: groovy ? 48 : 40,
          padding: 0,
          height: kineticGrid ? undefined : 220,
          minHeight: kineticGrid ? 180 : 220,
          border: 'none',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={groovy ? { scale: 0.92, rotate: -1 } : { scale: 0.97 }}
        transition={kineticGrid ? snapSpring : groovy ? groovySpring : squishBounce}
      >
        {kineticGrid ? (
          /* Proportional Impact: split background — Money (top), Carbon (bottom); white Marvin Visions in each half */
          <>
            <div className="absolute inset-0 flex flex-col">
              <div style={{ flex: moneyShare, background: 'var(--color-atomic-orange)' }} />
              <div style={{ flex: 1 - moneyShare, background: 'var(--color-turquoise)' }} />
            </div>
            <div className="absolute inset-0 flex justify-between items-start" style={{ padding: '12px 16px', pointerEvents: 'none' }}>
              <motion.h2 layoutId={`title-${journeyId}`} className="zone-card-label uppercase text-[10px] tracking-tight font-bold" style={whiteLabel}>
                {journeyId}
              </motion.h2>
              <div className="flex items-center gap-1">
                {showLocalTag && <span className="local-tag-badge">Local</span>}
                {journeyId === 'carbon' && localCarbonG != null && <span className="local-pulse-badge">{localCarbonG} g</span>}
                <img src={`/icons/journeys/${journeyId}.svg`} className="w-5 h-5 opacity-80" alt="" style={{ filter: 'brightness(0) invert(1)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col" style={{ padding: '36px 16px 12px', pointerEvents: 'none' }}>
              <div style={{ height: `${moneyShare * 100}%`, display: 'flex', alignItems: 'flex-end' }}>
                <motion.div layoutId={`data-container-${journeyId}`}>
                  <span className="block font-black text-base md:text-lg" style={{ ...whiteLabel, fontFamily: 'var(--font-label)' }}>{moneyValue}</span>
                  <span className="block text-[9px] opacity-90" style={whiteLabel}>/ yr</span>
                </motion.div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', minHeight: 0 }}>
                <div>
                  <span className="block font-black text-base md:text-lg" style={{ ...whiteLabel, fontFamily: 'var(--font-label)' }}>{carbonValue}</span>
                  <span className="block text-[9px] opacity-90" style={whiteLabel}>kg CO₂e / yr</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-start" style={{ padding: groovy ? 30 : 32 }}>
              <div className="flex flex-col gap-1">
                <motion.h2 layoutId={`title-${journeyId}`} className="zone-card-label uppercase text-sm tracking-tight" style={collapsedLabelStyle}>{journeyId}</motion.h2>
                {showLocalTag && <span className="local-tag-badge">Local</span>}
                {journeyId === 'carbon' && localCarbonG != null && <span className="local-pulse-badge">{localCarbonG} gCO₂/kWh</span>}
                {insightLabel && <span className="scraped-insight-tag" style={collapsedLabelStyle}>{insightLabel}</span>}
              </div>
              <img src={`/icons/journeys/${journeyId}.svg`} className="journey-icon w-6 h-6 opacity-80" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
            <motion.div layoutId={`data-container-${journeyId}`} className="flex flex-col gap-0" style={{ padding: '0 32px 32px' }}>
              <span className={`hero-value zone-card-number text-5xl block ${fromScraper ? 'text-data--count-in' : ''}`} style={collapsedLabelStyle}>{displayedValue}</span>
              <span className="zone-card-unit text-[10px] mt-0.5" style={collapsedLabelStyle}>{displayedUnit}</span>
            </motion.div>
          </>
        )}
      </motion.div>

      {!kineticGrid && (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            layoutId={`card-${journeyId}`}
            className={`fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-12 ${groovy ? 'bento-expanded' : ''}`}
            style={{
              backgroundColor: groovy ? color : 'rgba(0,0,0,0.2)',
              backdropFilter: groovy ? 'none' : 'blur(12px)',
              WebkitBackdropFilter: groovy ? 'none' : 'blur(12px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={groovy ? groovySpring : { type: 'spring', stiffness: 280, damping: 26 }}
            onAnimationComplete={() => triggerHaptic('light')}
          >
            <div
              className={`relative w-full h-full overflow-hidden flex flex-col p-8 md:p-16 ${groovy ? 'bg-white/95 rounded-none md:rounded-[48px] md:max-w-[80vw] md:max-h-[80vh] md:m-auto' : 'bg-white rounded-none md:rounded-[48px] md:max-w-[80vw] md:max-h-[80vh] md:m-auto'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute top-8 right-8 zone-card-label text-black uppercase text-xs tracking-widest z-10"
              >
                Close [esc]
              </button>

              <motion.h1
                layoutId={`title-${journeyId}`}
                className="zone-card-label text-2xl uppercase mb-8"
                style={{ color: 'var(--color-burnt)' }}
              >
                {journeyId}
              </motion.h1>

              <div className="flex-1 flex flex-col justify-center items-center max-w-2xl mx-auto w-full overflow-auto">
                {/* 1. Top Hero: Leading Metric — 120px Roboto 900 */}
                <motion.div
                  layoutId={`data-container-${journeyId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.2 }}
                  className="text-center mb-0"
                >
                  <span className="hero-value block text-[120px] leading-none font-black text-data" style={{ color: 'var(--color-burnt)', fontFamily: 'var(--font-label)' }}>
                    {primaryNumeric > 0 ? (lead === 'money' ? `£${slotValue}` : slotValue) : primaryValue}
                  </span>
                  <span className="zone-card-unit block mt-1 text-xl" style={{ fontSize: '1.25rem' }}>
                    {lead === 'money' ? 'per year' : 'kg CO₂e / yr'}
                  </span>
                </motion.div>

                {/* 2. Local Context Bar — 40px below Hero (council + Boiler Upgrade + grid) */}
                {localContextBar && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                    className="text-data deep-content-local-bar w-full text-center"
                    style={{ marginTop: 40 }}
                  >
                    <p className="crawler-tip-text" style={{ fontFamily: 'var(--font-label)', color: 'var(--color-burnt)' }}>
                      {localContextBar}
                    </p>
                  </motion.div>
                )}

                {/* 3. Secondary Metric — 40px below Hero (or below Local Bar) */}
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: stagger.delayCarbon }}
                  className="text-center"
                  style={{ marginTop: 40 }}
                >
                  <span className="block text-5xl font-black text-data" style={{ fontSize: 48, color: 'var(--color-burnt)', fontFamily: 'var(--font-label)' }}>
                    {secondaryValue}
                  </span>
                  <span className="zone-card-unit text-base opacity-90">
                    {lead === 'money' ? 'kg CO₂e / yr' : 'per year'}
                  </span>
                </motion.div>

                {/* 4. Crawler / scraped offer — 40px below, .text-data */}
                {(crawlerTip || insightLabel) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: stagger.delayTip }}
                    className="crawler-insight-box w-full text-data"
                    style={{ marginTop: 40 }}
                  >
                    <p className="crawler-tip-text" style={{ fontFamily: 'var(--font-label)', color: 'var(--color-burnt)' }}>
                      {crawlerTip || insightLabel}
                    </p>
                  </motion.div>
                )}

                {/* 5. 80px Action Core — Claim Offer / Go: squish (scaleY 0.8), heavy haptic */}
                <motion.button
                  type="button"
                  onClick={(e) => {
                    triggerHaptic('heavy')
                    if (claimOfferUrl) window.open(claimOfferUrl, '_blank')
                    handleActionCircle(e)
                  }}
                  className={`action-circle-80 mt-8 ${hasLocalGrant ? 'action-circle-local-grant' : ''}`}
                  style={{
                    marginTop: 24,
                    width: 80,
                    height: 80,
                    ...(hasLocalGrant && { background: 'var(--color-j-food)' }),
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92, scaleY: 0.8 }}
                  transition={squishBounce}
                >
                  <span className="text-white font-black uppercase text-[10px] tracking-widest">
                    {claimOfferUrl ? 'Claim offer' : 'Go'}
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      )}
    </>
  )
}
