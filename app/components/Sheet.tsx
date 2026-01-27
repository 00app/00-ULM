'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCarbon } from '@/lib/format'
import { getJourneyImage } from '@/lib/content/images'
import { JourneyId } from '@/lib/journeys'
import CircleCTA from './CircleCTA'

interface CardAction {
  actionType?: 'learn' | 'switch' | 'buy' | 'find' | 'apply' | 'view'
  learnUrl?: string
  actionUrl?: string
}

interface SheetData {
  id: string
  title: string
  subtitle?: string
  body?: string[]
  journey?: JourneyId
  image?: string
  data?: { money?: string; carbon?: string }
  source?: string
  sourceLabel?: string
  actions?: CardAction
}

function getActionLabel(actions?: CardAction): string {
  if (actions?.actionType === 'switch') return 'switch'
  if (actions?.actionType === 'buy') return 'buy'
  if (actions?.actionType === 'apply') return 'apply'
  if (actions?.actionType === 'find') return 'find'
  if (actions?.actionType === 'view') return 'view'
  return 'learn'
}

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  onSwitch?: () => void // Primary action (SWITCH button)
  data?: SheetData
}

/**
 * Sheet - Expanded card view with locked layout
 * 
 * Structure (top → bottom):
 * 1. IMAGE (4:3 aspect ratio, 40px radius)
 * 2. HEADING (h3 style)
 * 3. BODY COPY (max 2 paragraphs, scrolls if needed)
 * 4. DATA ROW (carbon first, money second)
 * 5. ACTION ROW — START | ACTION (optional) | LEARN. Never mix.
 */
export default function Sheet({ isOpen, onClose, data }: SheetProps) {
  const router = useRouter()

  if (!isOpen) return null
  
  if (!data) {
    // Show minimal loading state
    return (
      <>
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 18, 104, 0.4)',
            zIndex: 110,
            touchAction: 'auto',
          }}
        />
        <div
          className="sheet sheet-container"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--color-ice)',
            borderRadius: '60px 60px 0 0',
            padding: '20px',
            maxHeight: '90vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            touchAction: 'pan-y',
          }}
        >
          <p style={{ color: 'var(--color-deep)' }}>loading...</p>
        </div>
      </>
    )
  }

  const handleStart = () => {
    if (data.journey) {
      router.push(`/journeys/${data.journey}`)
      onClose()
    }
  }

  const handleAction = () => {
    const url = data?.actions?.actionUrl
    if (!url) return
    try {
      void fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'card_action',
          cardId: data?.id,
          actionType: data?.actions?.actionType ?? 'learn',
          journey: data?.journey,
        }),
      })
    } catch {
      // Ignore
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleLearn = () => {
    const url = data?.actions?.learnUrl ?? data?.source
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Use body[] (explanation paragraphs) if provided, else subtitle
  const paragraphs = data.body && data.body.length > 0
    ? data.body
    : (data.subtitle ? data.subtitle.split('\n') : [])

  // Resolve image - check data.image first, then journey-based resolution
  const journeyImage = data.journey ? getJourneyImage(data.journey, 'card-standard', 0) : null
  const resolvedImage = data.image !== undefined
    ? data.image
    : journeyImage
  // Only show image if we have a valid path
  const hasImage = resolvedImage !== null && resolvedImage !== undefined

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(20, 18, 104, 0.4)',
          zIndex: 110,
          animation: 'fadeUp 120ms var(--easing-zero) forwards',
          touchAction: 'auto',
          WebkitTapHighlightColor: 'transparent',
        }}
      />
      
      {/* Sheet */}
      <div
        className="sheet"
        onClick={(e) => {
          // Prevent sheet clicks from closing
          e.stopPropagation()
        }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--color-ice)',
          borderRadius: '60px 60px 0 0',
          padding: '20px 20px 40px 20px',
          maxHeight: '90vh',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 120,
          boxSizing: 'border-box',
          width: '100%',
          touchAction: 'pan-y',
          WebkitTapHighlightColor: 'transparent',
          WebkitOverflowScrolling: 'touch',
          transform: 'translateY(0)',
          opacity: 1,
        }}
      >
        {/* Content container - scrollable (normal flow) */}
        <div className="sheet-content">
          {/* 1. IMAGE (TOP) - Only show if image exists */}
          {hasImage && (
            <div
              style={{
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: 40,
                backgroundImage: `url(${resolvedImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                marginBottom: 20,
                flexShrink: 0,
              }}
            />
          )}

          {/* 2. HEADING - shared 3-line title slot */}
          <h3
            className="card-title-slot"
            style={{
              color: 'var(--color-deep)',
            }}
          >
            {data.title ?? ''}
          </h3>

          {/* 3. BODY COPY */}
          {paragraphs.length > 0 && (
            <div
              style={{
                marginBottom: 20,
                maxWidth: '100%',
                textAlign: 'left',
              }}
            >
              {paragraphs.map((para, index) => (
                <p
                  key={index}
                  className="text-body"
                  style={{
                    color: 'var(--color-deep)',
                    marginBottom: index < paragraphs.length - 1 ? 10 : 0,
                    textAlign: 'left',
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          )}

          {/* 4. DATA ROW */}
          {data.data && (data.data.money || data.data.carbon) && (
            <div
              style={{
                display: 'flex',
                gap: 20,
                marginBottom: 20,
                flexShrink: 0,
              }}
            >
              {/* Carbon first */}
              {data.data.carbon && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', textAlign: 'left' }}>
                  <span className="text-label" style={{ fontSize: 10, lineHeight: '14px', letterSpacing: 0, textAlign: 'left' }}>
                    CARBON
                  </span>
                  <div className="text-data" style={{ color: 'var(--color-blue)', textAlign: 'left' }}>
                    {formatCarbon(data.data.carbon)}
                  </div>
                </div>
              )}
              {/* Money second */}
              {data.data.money && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', textAlign: 'left' }}>
                  <span className="text-label" style={{ fontSize: 10, lineHeight: '14px', letterSpacing: 0, textAlign: 'left' }}>
                    MONEY
                  </span>
                  <div className="text-data" style={{ color: 'var(--color-deep)', textAlign: 'left' }}>
                    {data.data.money}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. ACTION ROW — normal flow, always below content */}
        <div className="sheet-cta-row">
          {/* START — internal route */}
          {data.journey && (
            <CircleCTA variant="text" text="start" onClick={handleStart} />
          )}

          {/* ACTION — external provider URL (optional) */}
          {data.actions?.actionUrl && (
            <CircleCTA
              variant="text"
              text={getActionLabel(data.actions)}
              onClick={handleAction}
              primary
            />
          )}

          {/* LEARN — source URL, always */}
          <CircleCTA
            variant="text"
            text="learn"
            onClick={handleLearn}
            disabled={!data.actions?.learnUrl && !data?.source}
          />
        </div>
      </div>
    </>
  )
}
