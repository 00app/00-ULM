'use client'

import React from 'react'
import { JourneyId } from '@/lib/journeys'
import { getJourneyColorHex } from '@/lib/journeyColors'

export interface BentoCardItem {
  id: string
  title: string
  journey_key?: JourneyId
  category?: JourneyId
  data?: { carbon: string; money: string }
  source?: string
  sourceLabel?: string
  explanation?: string[]
  actions?: {
    actionType: 'learn' | 'switch' | 'buy' | 'find' | 'apply' | 'view'
    learnUrl: string
    actionUrl?: string
  }
}

interface ZoneBentoCardProps {
  item: BentoCardItem
  variant: 'hero' | 'square' | 'small'
  isExpanded: boolean
  onTap: () => void
  onClose: () => void
}

function ZeroLogoIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 126 200" fill="none">
      <path d="M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z" fill="currentColor" />
      <path d="M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z" fill="currentColor" />
      <path d="M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411" fill="currentColor" />
    </svg>
  )
}

export default function ZoneBentoCard({ item, variant, isExpanded, onTap, onClose }: ZoneBentoCardProps) {
  const journey = item.journey_key || item.category || 'home'
  const journeyColor = getJourneyColorHex(journey)
  const variantClass = variant === 'hero' ? 'hero-card' : variant === 'square' ? 'square-card' : 'small-card'
  const shimmerClass = isExpanded ? 'zone-card--shimmer' : ''

  const handleClick = () => {
    if (isExpanded) return
    onTap()
  }

  const actionLabel = (item.actions?.actionType === 'switch' ? 'Switch' : item.actions?.actionType === 'buy' ? 'Buy' : item.actions?.actionType === 'apply' ? 'Apply' : 'Learn')

  return (
    <div
      className={`zone-card ${variantClass} ${isExpanded ? 'expanded' : ''} ${shimmerClass}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (isExpanded) onClose()
          else onTap()
        }
      }}
      style={
        !isExpanded
          ? { backgroundColor: `var(--color-j-${journey})` }
          : undefined
      }
    >
      <div className="zone-card-shimmer" aria-hidden />
      <span
        className="zone-card-pill"
        style={{ borderColor: journeyColor }}
      >
        {journey}
      </span>

      {!isExpanded && (
        <div className="zone-card-value">
          {item.data?.carbon && item.data?.money
            ? `${item.data.carbon} · ${item.data.money}`
            : item.data?.carbon ?? item.data?.money ?? item.title}
        </div>
      )}

      {isExpanded && (
        <>
          <ZeroLogoIcon className="zone-card-expanded-logo" style={{ color: 'var(--color-blue)' }} />
          <div className="zone-card-expanded-content">
            <h4 style={{
              fontFamily: 'Roboto',
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: -1,
              textTransform: 'lowercase',
              color: 'var(--color-deep)',
              marginBottom: 8,
            }}>
              {item.title}
            </h4>
            {item.explanation?.length ? (
              <p className="zz-body" style={{ marginBottom: 12 }}>
                {item.explanation[0]}
              </p>
            ) : null}
            {item.data && (
              <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                {item.data.carbon && (
                  <span className="text-label">{item.data.carbon}</span>
                )}
                {item.data.money && (
                  <span className="text-label">{item.data.money}</span>
                )}
              </div>
            )}
            <div className="zone-card-actions">
              <button
                type="button"
                className="zz-button zz-cta-primary"
                style={{ padding: '10px 20px', fontSize: 10 }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (item.actions?.actionUrl) window.open(item.actions.actionUrl, '_blank')
                  else if (item.actions?.learnUrl) window.open(item.actions.learnUrl, '_blank')
                }}
              >
                {actionLabel}
              </button>
              <button
                type="button"
                className="zz-button"
                style={{ padding: '10px 20px', fontSize: 10 }}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
