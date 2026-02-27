'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { JourneyId } from '@/lib/journeys'
import { getJourneyColorVar } from '@/lib/journeyColors'
import type { ZoneHero, ZoneJourneyCard, ZoneTipCard } from '@/lib/zone/buildZoneViewModel'

export type ZoneCardItem = ZoneHero | ZoneJourneyCard | ZoneTipCard

/* Layout tokens — state-driven Pop & Shift (FORK-ZONE-SPEC) */
const WIDTH_HERO = 280
const WIDTH_SQUARE = 135
const WIDTH_SMALL = 86
const HEIGHT_HERO = 135
const HEIGHT_SQUARE = 135
const HEIGHT_SMALL = 86
const MIN_HEIGHT_EXPANDED = 320

const RADIUS_HERO = 80
const RADIUS_SQUARE = 64
const RADIUS_SMALL = 40
const RADIUS_EXPANDED = 96
const PADDING_HERO = 16
const PADDING_SQUARE = 16
const PADDING_SMALL = 12
const PADDING_EXPANDED = 32

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }
const SHIMMER_MS = 300
const CONTENT_REVEAL_DELAY_MS = 300
const CONTENT_REVEAL_DURATION_MS = 200

type SizeRole = 'hero' | 'square' | 'small'

interface ZoneCardProps {
  item: ZoneCardItem
  sizeRole: SizeRole
  index: number
  isExpanded: boolean
  onTap: () => void
  onClose: () => void
  onSave?: (id: string) => void
  isLiked?: boolean
}

function getActionLabel(actions?: ZoneCardItem['actions']): string {
  if (actions?.actionType === 'switch') return 'do it'
  if (actions?.actionType === 'buy') return 'do it'
  if (actions?.actionType === 'apply') return 'do it'
  if (actions?.actionType === 'find') return 'do it'
  if (actions?.actionType === 'view') return 'do it'
  return 'do it'
}

export default function ZoneCard({
  item,
  sizeRole,
  index,
  isExpanded,
  onTap,
  onClose,
  onSave,
  isLiked = false,
}: ZoneCardProps) {
  const journey = item.journey_key ?? 'home'
  const journeyVar = getJourneyColorVar(journey as JourneyId)
  const [shimmer, setShimmer] = useState(false)
  const [contentVisible, setContentVisible] = useState(!isExpanded)

  useEffect(() => {
    if (isExpanded) {
      setShimmer(true)
      setContentVisible(false)
      const t = setTimeout(() => setShimmer(false), SHIMMER_MS)
      const t2 = setTimeout(() => setContentVisible(true), CONTENT_REVEAL_DELAY_MS)
      return () => {
        clearTimeout(t)
        clearTimeout(t2)
      }
    } else {
      setContentVisible(true)
    }
  }, [isExpanded])

  const collapsedRadius =
    sizeRole === 'hero' ? RADIUS_HERO : sizeRole === 'square' ? RADIUS_SQUARE : RADIUS_SMALL
  const collapsedWidth =
    sizeRole === 'hero' ? WIDTH_HERO : sizeRole === 'square' ? WIDTH_SQUARE : WIDTH_SMALL
  const collapsedHeight =
    sizeRole === 'hero' ? HEIGHT_HERO : sizeRole === 'square' ? HEIGHT_SQUARE : HEIGHT_SMALL
  const collapsedPadding =
    sizeRole === 'hero' ? PADDING_HERO : sizeRole === 'square' ? PADDING_SQUARE : PADDING_SMALL

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSave?.(item.id)
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: `${item.title} — CO₂ ${item.data?.carbon ?? ''} · ${item.data?.money ?? ''}`,
          url: window.location.href,
        })
      } catch {
        // Ignore
      }
    }
  }

  const handleDoIt = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = (item as ZoneJourneyCard).actions?.actionUrl ?? (item as ZoneJourneyCard).actions?.learnUrl ?? item.source
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      layout
      layoutId={`zone-card-${item.id}`}
      initial={false}
      transition={SPRING}
      onClick={isExpanded ? undefined : onTap}
      style={{
        width: isExpanded ? '100%' : collapsedWidth,
        height: isExpanded ? 'auto' : collapsedHeight,
        minHeight: isExpanded ? MIN_HEIGHT_EXPANDED : collapsedHeight,
        borderRadius: isExpanded ? RADIUS_EXPANDED : collapsedRadius,
        padding: isExpanded ? PADDING_EXPANDED : collapsedPadding,
        background: 'var(--color-cool)',
        cursor: isExpanded ? 'default' : 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Roboto',
      }}
    >
      {isExpanded ? (
        <>
          {/* Shimmer overlay */}
          <AnimatePresence>
            {shimmer && (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: SHIMMER_MS / 1000 }}
                className="zone-shimmer-overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  animation: 'zone-shimmer 300ms ease-out',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            )}
          </AnimatePresence>

          {/* Top: Journey pill — 1.5px border, no fill */}
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '6px 14px',
              borderRadius: 999,
              border: '1.5px solid',
              borderColor: journeyVar,
              color: 'var(--color-deep)',
              fontFamily: 'Roboto',
              fontSize: 10,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: 0,
              marginBottom: 16,
            }}
          >
            {item.category ?? journey}
          </div>

          {/* Middle: Expanded content — no images, type only; reveal 300–500ms with 10px upward slide */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: contentVisible ? 1 : 0, y: contentVisible ? 0 : 10 }}
            transition={{ duration: CONTENT_REVEAL_DURATION_MS / 1000, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginBottom: 24,
            }}
          >
            {item.title && (
              <h4
                style={{
                  fontFamily: 'Roboto',
                  fontWeight: 900,
                  fontSize: 20,
                  lineHeight: 1.2,
                  letterSpacing: '-1px',
                  textTransform: 'lowercase',
                  color: 'var(--color-deep)',
                }}
              >
                {item.title}
              </h4>
            )}
            <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <span
                  className="text-label"
                  style={{
                    display: 'block',
                    fontFamily: 'Roboto',
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: 'var(--color-deep)',
                    marginBottom: 2,
                  }}
                >
                  CO₂ saving
                </span>
                <span
                  className="text-data zone-display-small"
                  style={{
                    fontFamily: 'Roboto',
                    fontWeight: 900,
                    fontSize: 36,
                    lineHeight: 1.1,
                    letterSpacing: '-2px',
                    textTransform: 'lowercase',
                    color: 'var(--color-blue)',
                  }}
                >
                  {item.data?.carbon ?? 'n/a'}
                </span>
              </div>
              <div>
                <span
                  className="text-label"
                  style={{
                    display: 'block',
                    fontFamily: 'Roboto',
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: 'var(--color-deep)',
                    marginBottom: 2,
                  }}
                >
                  Money saving
                </span>
                <span
                  className="text-data zone-display-small"
                  style={{
                    fontFamily: 'Roboto',
                    fontWeight: 900,
                    fontSize: 36,
                    lineHeight: 1.1,
                    letterSpacing: '-2px',
                    textTransform: 'lowercase',
                    color: 'var(--color-deep)',
                  }}
                >
                  {item.data?.money ?? 'n/a'}
                </span>
              </div>
            </div>
            {item.sourceLabel && (
              <span
                style={{
                  fontFamily: 'Roboto',
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: 'var(--color-deep)',
                  opacity: 0.8,
                }}
              >
                {item.sourceLabel}
              </span>
            )}
          </motion.div>

          {/* Bottom: 3-button row + CLOSE — same 10px upward reveal */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: contentVisible ? 1 : 0, y: contentVisible ? 0 : 10 }}
            transition={{ duration: CONTENT_REVEAL_DURATION_MS / 1000, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 'auto',
              paddingTop: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  fontFamily: 'Roboto',
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: 'var(--color-deep)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                save
              </button>
              <button
                type="button"
                onClick={handleShare}
                style={{
                  fontFamily: 'Roboto',
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: 'var(--color-deep)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                share
              </button>
              <button
                type="button"
                onClick={handleDoIt}
                style={{
                  fontFamily: 'Roboto',
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: 'var(--color-blue)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {getActionLabel((item as ZoneJourneyCard).actions)}
              </button>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              style={{
                fontFamily: 'Roboto',
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                color: 'var(--color-deep)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              close
            </button>
          </motion.div>
        </>
      ) : (
        /* Collapsed: minimal preview */
        <>
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '4px 10px',
              borderRadius: 999,
              border: '1.5px solid',
              borderColor: journeyVar,
              fontFamily: 'Roboto',
              fontSize: 10,
              fontWeight: 900,
              textTransform: 'uppercase',
              color: 'var(--color-deep)',
              marginBottom: 6,
            }}
          >
            {item.category ?? journey}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, flexWrap: 'wrap' }}>
            <span
              className="text-data"
              style={{
                fontFamily: 'Roboto',
                fontWeight: 900,
                fontSize: 20,
                lineHeight: 1.2,
                letterSpacing: '-1px',
                textTransform: 'lowercase',
                color: 'var(--color-blue)',
              }}
            >
              {item.data?.carbon ?? 'n/a'}
            </span>
            <span
              style={{
                fontFamily: 'Roboto',
                fontWeight: 900,
                fontSize: 20,
                lineHeight: 1.2,
                letterSpacing: '-1px',
                textTransform: 'lowercase',
                color: 'var(--color-deep)',
              }}
            >
              {item.data?.money ?? 'n/a'}
            </span>
          </div>
        </>
      )}
    </motion.div>
  )
}
