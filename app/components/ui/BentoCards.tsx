'use client'

import { motion } from 'framer-motion'
import type { JourneyId } from '@/lib/journeys'
import { parseMoneyGbpFromDisplay, parseCarbonKgFromDisplay } from '@/lib/format'
import { StampedMoneyGbp, StampedCarbonKg } from '@/app/components/StampedMetric'
import { FunkyCircleCTA } from './Buttons'
import { QuestionContainer } from './QuestionLayout'

import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

export interface PreviewBentoCardProps {
  journeyId: JourneyId
  label: string
  tip: string
  moneyValue: string
  carbonValue: string
  onClick?: () => void
  className?: string
  /** Grid span: 1 or 2 (desktop). Default 1. */
  span?: 1 | 2
}

/**
 * Zero Zero Funky — Collapsed bento. 60px groovy radius. Journey background, yellow text. Label + body + £/kg.
 */
export function PreviewBentoCard({
  journeyId,
  label,
  tip,
  moneyValue,
  carbonValue,
  onClick,
  className = '',
  span = 1,
}: PreviewBentoCardProps) {
  const bg = `var(--color-j-${journeyId})`
  return (
    <motion.div
      onClick={onClick}
      className={`rounded-[60px] flex flex-col justify-end cursor-pointer ${className}`}
      style={{
        background: bg,
        color: 'var(--color-yellow)',
        ['--color-ink' as string]: 'var(--color-yellow)',
        boxShadow: 'none',
        gridColumn: span === 2 ? 'span 2' : 'span 1',
        padding: 'var(--padding-bento)',
      }}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={INDUSTRIAL_OPACITY_SNAP}
    >
      <span
        className="mb-1"
        style={{
          fontFamily: 'var(--font-label)',
          fontSize: 'var(--zz-h4-mobile)',
          lineHeight: 'var(--zz-lh-heading)',
          letterSpacing: 'var(--zz-track-marvin)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <p
        className="mb-3 line-clamp-2"
        style={{
          fontFamily: 'var(--font-roboto), sans-serif',
          fontWeight: 800,
          fontSize: 'var(--zz-body-size)',
          lineHeight: 'var(--zz-lh-body)',
        }}
      >
        {tip}
      </p>
      <div
        className="flex items-baseline gap-3 flex-wrap"
        style={{
          fontFamily: 'var(--font-label)',
          fontSize: 'var(--zz-h2-mobile)',
          lineHeight: 'var(--zz-lh-heading)',
          fontWeight: 'bold',
        }}
      >
        <span className="data-value data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
          <StampedMoneyGbp gbp={parseMoneyGbpFromDisplay(moneyValue || '0')} />
        </span>
        <span className="data-value data-stamp-metric" style={{ color: 'var(--color-ink)' }}>
          <StampedCarbonKg kg={parseCarbonKgFromDisplay(carbonValue || '0')} />
        </span>
      </div>
    </motion.div>
  )
}

export interface ExpandedBentoCardProps {
  journeyId: JourneyId
  /** Hero DATA values (e.g. £1,200 · 400 kg) */
  heroValues: React.ReactNode
  /** Scraped tip or local tip — Roboto body scale */
  tip: string
  /** Trinity: e.g. CLAIM, LIKE, ASK. Rendered as FunkyCircleCTAs. */
  trinityActions: Array<{ label: string; onClick?: () => void; icon?: React.ReactNode }>
  /** Question + answer area, exactly 40px below trinity. */
  questionSlot: React.ReactNode
  onClose?: () => void
  className?: string
}

/**
 * Zero Zero Funky — Expanded bento. Full width. Yellow bg, journey-colored text. Hero → tip → Trinity → Question 40px below.
 */
export function ExpandedBentoCard({
  journeyId,
  heroValues,
  tip,
  trinityActions,
  questionSlot,
  onClose,
  className = '',
}: ExpandedBentoCardProps) {
  const journeyColor = `var(--color-j-${journeyId})`
  return (
    <motion.div
      className={`rounded-[60px] flex flex-col ${className}`}
      style={{
        background: 'var(--color-yellow)',
        color: journeyColor,
        boxShadow: 'none',
        gridColumn: '1 / -1',
        padding: 'var(--padding-bento)',
      }}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={INDUSTRIAL_OPACITY_SNAP}
    >
      {/* 1. Hero DATA values */}
      <div
        className="mb-4"
        style={{
          fontFamily: 'var(--font-label)',
          fontSize: 'var(--zz-h3-mobile)',
          fontWeight: 'bold',
          lineHeight: 'var(--zz-lh-heading)',
        }}
      >
        {heroValues}
      </div>

      {/* 2. Scraped tip — Roboto 400 */}
      <p
        className="mb-6"
        style={{
          fontFamily: 'var(--font-roboto), sans-serif',
          fontWeight: 800,
          fontSize: 'var(--zz-body-size)',
          lineHeight: 'var(--zz-lh-body)',
          color: 'var(--color-purple)',
        }}
      >
        {tip}
      </p>

      {/* 3. Trinity flex row */}
      <div className="flex flex-wrap items-center gap-4 mb-[40px]">
        {trinityActions.map((action, i) => (
          <FunkyCircleCTA
            key={i}
            label={action.label}
            variant={i === 0 ? 'primary' : 'secondary'}
            onClick={action.onClick}
            icon={action.icon}
          />
        ))}
      </div>

      {/* 4. Question container — exactly 40px below CTAs (margin-top already 40px on QuestionContainer's child area; here we use margin-top 40px for the slot) */}
      <div style={{ marginTop: 40 }}>
        {questionSlot}
      </div>
    </motion.div>
  )
}
