'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCarbon } from '@/lib/format'
import { JourneyId } from '@/lib/journeys'
import { getJourneyColorHex, JOURNEY_COLOR_MAP } from '@/lib/journeyColors'
import { useApp } from '@/app/context/AppContext'
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
  /** When true, hide the Start CTA (journey already completed) */
  isJourneyComplete?: boolean
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
export default function Sheet({ isOpen, onClose, data, isJourneyComplete = false }: SheetProps) {
  const router = useRouter()
  const { state, toggleLike } = useApp()
  const isLiked = data?.id ? state.likedCards.includes(data.id) : false
  const [imageStrike, setImageStrike] = useState<1 | 2 | 3>(1)

  // Completion: hide Start if parent says complete OR journey_answers exist in localStorage
  const hasJourneyAnswers = (() => {
    if (typeof window === 'undefined' || !data?.journey) return false
    const raw = localStorage.getItem(`journey_${data.journey}_answers`)
    if (!raw) return false
    try {
      const obj = JSON.parse(raw)
      return obj && typeof obj === 'object' && Object.keys(obj).length > 0
    } catch {
      return false
    }
  })()
  const showStart = data?.journey && !isJourneyComplete && !hasJourneyAnswers

  useEffect(() => {
    if (data?.id || data?.journey) setImageStrike(1)
  }, [data?.id, data?.journey])

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

  // Three-Strike: 1) Local /cards/{journey}/standard.jpg 2) Unsplash API 3) Journey color + ICE icon
  const journey = data.journey
  const localPath = journey ? `/cards/${journey}/standard.jpg` : null
  const unsplashKeyword = journey ? (JOURNEY_COLOR_MAP[journey]?.keyword ?? 'minimalist-lifestyle') : null
  const unsplashUrl = journey ? `https://source.unsplash.com/featured/800x600?${unsplashKeyword}` : null
  const strike1Url = data.image ?? localPath
  const currentImageSrc = imageStrike === 1 ? strike1Url : imageStrike === 2 ? unsplashUrl : null
  const useColorBlock = !currentImageSrc || imageStrike === 3
  const handleSheetImageError = () => {
    if (imageStrike === 1 && unsplashUrl) setImageStrike(2)
    else setImageStrike(3)
  }

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
          {/* 1. IMAGE / COLOR BLOCK — Three-Strike: local → Unsplash → journey color + ICE icon */}
          {currentImageSrc ? (
            <div className="sheet-image-container">
              <img src={currentImageSrc} alt="" onError={handleSheetImageError} key={imageStrike} />
            </div>
          ) : journey ? (
            <div
              className="sheet-image-container"
              style={{
                background: getJourneyColorHex(journey),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'Roboto',
                  fontSize: 40,
                  fontWeight: 900,
                  color: 'var(--color-ice)',
                  textTransform: 'lowercase',
                }}
                aria-hidden
              >
                {journey.charAt(0)}
              </span>
            </div>
          ) : null}

          {/* 2. HEADING */}
          <h3 className="sheet-title-slot" style={{ marginBottom: 4 }}>
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

        {/* 5. ACTION ROW — centered: [Start] [Action?] [Heart] [Learn]; Heart sibling of Learn, both 80×80; Start hidden when journey_answers exist */}
        <div className="sheet-cta-row">
          {showStart && (
            <CircleCTA variant="text" text="start learning" onClick={handleStart} />
          )}

          {data.actions?.actionUrl && (
            <CircleCTA
              variant="text"
              text={getActionLabel(data.actions)}
              onClick={handleAction}
              primary
            />
          )}

          {/* Heart (Like) — 80×80, sibling of Learn */}
          <CircleCTA
            variant="icon"
            icon="heart"
            onClick={async () => {
              if (!data?.id) return
              const userId = state.userId || (typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null)
              if (userId) {
                try {
                  await fetch('/api/likes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, card_id: data.id }),
                  })
                } catch {
                  // ignore
                }
              }
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([12, 60, 12])
              }
              toggleLike(data.id)
            }}
            style={isLiked ? { background: 'var(--color-pink)', color: 'var(--color-ice)' } : undefined}
          />

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
