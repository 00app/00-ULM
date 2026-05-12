'use client'

import React, { useState, useEffect } from 'react'
import { JourneyId } from '@/lib/journeys'
import {
  getJourneyColorHex,
  JOURNEY_COLOR_MAP,
  COLOR_YELLOW,
  COLOR_PURPLE,
  COLOR_PINK,
  COLOR_SOFT_CREAM,
} from '@/lib/journeyColors'

/** Strike 1: Local path in /public/cards/{journey}/{variant}.jpg */
function getLocalCardPath(journey: JourneyId, variant: 'card-hero' | 'card-standard'): string {
  const v = variant === 'card-hero' ? 'hero' : 'standard'
  return `/cards/${journey}/${v}.jpg`
}

/** Strike 2: Live Unsplash — featured/800x600?{keyword} (keywords from journeyColors) */
function getUnsplashImageUrl(journey: JourneyId): string {
  const keyword = JOURNEY_COLOR_MAP[journey]?.keyword ?? 'minimalist-lifestyle'
  return `https://source.unsplash.com/featured/800x600?${keyword}`
}

/** v1.8.3 — three primaries + soft cream only (no legacy blue / ice / cool greys). */
const COLORS = {
  ACCENT: COLOR_PURPLE,
  SURFACE: COLOR_SOFT_CREAM,
  ON_DARK: COLOR_YELLOW,
  ON_LIGHT: COLOR_PURPLE,
  CARBON: COLOR_PINK,
  MONEY: COLOR_PURPLE,
  PINK: COLOR_PINK,
} as const

/**
 * Get semantic colors for a card variant
 * Returns all color decisions based on variant and intent
 */
function getCardColors(variant: 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked') {
  if (variant === 'card-hero') {
    return {
      background: COLORS.ACCENT,
      title: COLORS.ON_DARK,
      subtitle: COLORS.ON_DARK,
      carbonValue: COLORS.ON_DARK,
      moneyValue: COLORS.ON_DARK,
      label: COLORS.ON_DARK,
      source: COLORS.ON_DARK,
      badgeBg: COLORS.PINK,
      badgeText: COLORS.ON_DARK,
    }
  }

  if (variant === 'card-standard') {
    return {
      background: COLORS.SURFACE,
      title: COLORS.ON_LIGHT,
      carbonValue: COLORS.CARBON,
      moneyValue: COLORS.MONEY,
      label: COLORS.ON_LIGHT,
      source: COLORS.ON_LIGHT,
      badgeBg: COLORS.PINK,
      badgeText: COLORS.ON_DARK,
    }
  }

  if (variant === 'card-liked') {
    return {
      background: COLORS.ACCENT,
      title: COLORS.ON_DARK,
      carbonValue: COLORS.ON_DARK,
      moneyValue: COLORS.ON_DARK,
      label: COLORS.ON_DARK,
      source: COLORS.ON_DARK,
      badgeBg: COLORS.PINK,
      badgeText: COLORS.ON_DARK,
    }
  }

  return {
    background: COLORS.SURFACE,
    title: COLORS.ON_LIGHT,
    carbonValue: COLORS.CARBON,
    moneyValue: COLORS.MONEY,
    label: COLORS.ON_LIGHT,
    source: COLORS.ON_LIGHT,
    badgeBg: COLORS.PINK,
    badgeText: COLORS.ON_DARK,
    arrowBg: COLORS.ACCENT,
    arrowColor: COLORS.ON_DARK,
  }
}

interface CardProps {
  variant: 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked'
  children?: React.ReactNode
  onClick?: () => void
  image?: string | null // Deterministic image path (or null)
  journey?: JourneyId // Used for deterministic image resolution fallback
  title?: string
  subtitle?: string
  category?: string // Category badge MUST be journey key (lowercase, e.g., 'home', 'travel', 'food')
  source?: string // Source URL for link
  sourceLabel?: string // Human-readable source label (e.g., "SOURCE. uk government")
  data?: {
    money?: string
    carbon?: string
  }
}

/**
 * Card Components - Locked dimensions and styling
 * ONLY FOUR VARIANTS ALLOWED:
 * - card-hero: Hero (370×658px mobile, 960×420px desktop, 60px radius)
 * - card-standard: Standard (370×278px image + 330px text container below)
 * - card-compact: Compact (330px width, 40px radius, text only)
 * - card-liked: Liked (same as compact, always DEEP bg, ICE text/data)
 */
export default function Card({ variant, children, onClick, image, journey, title, subtitle, category, source, sourceLabel, data }: CardProps) {
  // Hooks must be called unconditionally at top
  const [imageStrike, setImageStrike] = useState<1 | 2 | 3>(1)
  const [imageLoaded, setImageLoaded] = useState(false)
  useEffect(() => {
    setImageLoaded(false)
  }, [imageStrike, journey])

  // LOCKED: Only 4 variants allowed
  const allowedVariants = ['card-hero', 'card-standard', 'card-compact', 'card-liked'] as const
  if (!allowedVariants.includes(variant as any)) {
    console.error(`[Card] Invalid variant "${variant}". Must be one of: ${allowedVariants.join(', ')}`)
    return null
  }

  // Three-Strike Fallback: 1) Local → 2) Unsplash 800x600?keyword → 3) Journey color + category label
  const hasImageVariant = (variant === 'card-hero' || variant === 'card-standard') && journey
  const localPath = hasImageVariant ? getLocalCardPath(journey!, variant) : null
  const unsplashUrl = hasImageVariant ? getUnsplashImageUrl(journey!) : null
  const strike1Url = (image != null && typeof image === 'string' && image.length > 0)
    ? image
    : hasImageVariant ? localPath : null
  const currentImageSrc =
    imageStrike === 1 ? strike1Url : imageStrike === 2 ? unsplashUrl ?? null : null
  const useColorFallback = !currentImageSrc || imageStrike === 3
  const handleImageError = () => {
    if (imageStrike === 1 && unsplashUrl) setImageStrike(2)
    else setImageStrike(3)
  }
  const handleImageLoad = () => setImageLoaded(true)

  if (variant === 'card-liked' && currentImageSrc) {
    console.error(`[Card] card-liked variant must NOT render images. Image: ${currentImageSrc}`)
  }

  // Get semantic colors for this card
  const colors = getCardColors(variant)

  // Card-Hero: Hero Card (LOCKED LAYOUT - Responsive)
  if (variant === 'card-hero') {
    
    return (
      <div
        className="card card-hero"
        onClick={onClick}
        onTouchStart={(e) => {
          // Prevent default touch behavior
          e.stopPropagation()
        }}
        onTouchEnd={(e) => {
          // Trigger onClick on touch end for mobile (onClick will handle the actual action)
          e.stopPropagation()
          if (onClick) {
            onClick()
          }
        }}
        style={{
          borderRadius: 60,
          ...(useColorFallback && journey ? {
            ['--fallback-color' as string]: getJourneyColorHex(journey),
            background: 'var(--fallback-color)',
          } : currentImageSrc ? {} : { background: COLOR_SOFT_CREAM }),
          cursor: onClick ? 'pointer' : 'default',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {currentImageSrc && (
          <img
            src={currentImageSrc}
            alt=""
            onError={handleImageError}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Top Row: Badge + Arrow */}
        <div className="hero-top-row" style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Category Badge - MUST be journey key (lowercase) */}
          <div style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 15,
            background: colors.badgeBg,
            fontFamily: 'Roboto',
            fontSize: 10,
            fontWeight: 900,
            textTransform: 'uppercase',
            color: colors.badgeText,
            display: 'inline-flex',
            alignItems: 'center',
          }}>
            {category || 'home'}
          </div>

          {/* Arrow CTA */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: COLORS.ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke={COLORS.ON_DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Blue Data Panel (Bottom, Left) */}
        <div className="hero-data-panel" style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          width: 330,
          background: colors.background,
          borderRadius: 40,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          textAlign: 'left',
        }}>
          {/* Title (H4) - locked 3-line slot */}
          {title && (
            <h4
              className="card-title-slot"
              style={{
                color: colors.title,
                textAlign: 'left',
              }}
            >
              {title ?? ''}
            </h4>
          )}

          {/* Subtitle (optional, uses same slot behaviour) */}
          {subtitle && (
            <h4
              className="card-title-slot"
              style={{
                color: colors.subtitle,
                textAlign: 'left',
              }}
            >
              {subtitle ?? ''}
            </h4>
          )}

          {/* Data Row (2 Columns) - Carbon first, Money second */}
          <div style={{
            display: 'flex',
            gap: 20,
            marginTop: 4,
            textAlign: 'left',
          }}>
            {/* Carbon Column (FIRST) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              textAlign: 'left',
            }}>
              <span style={{
                fontFamily: 'Roboto',
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                color: colors.label,
                lineHeight: '14px',
                letterSpacing: 0,
                textAlign: 'left',
              }}>
                CARBON
              </span>
              <span className="hero-value" style={{
                fontFamily: 'Roboto',
                fontSize: 50,
                fontWeight: 900,
                lineHeight: '49px',
                letterSpacing: '-2px',
                textTransform: 'lowercase',
                color: colors.carbonValue,
                textAlign: 'left',
              }}>
                {data?.carbon || 'n/a'}
              </span>
            </div>

            {/* Money Column (SECOND) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              textAlign: 'left',
            }}>
              <span style={{
                fontFamily: 'Roboto',
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                color: colors.label,
                lineHeight: '14px',
                letterSpacing: 0,
                textAlign: 'left',
              }}>
                SAVE
              </span>
              <span className="hero-value" style={{
                fontFamily: 'Roboto',
                fontSize: 50,
                fontWeight: 900,
                lineHeight: '49px',
                letterSpacing: '-2px',
                textTransform: 'lowercase',
                color: colors.moneyValue,
                textAlign: 'left',
              }}>
                {data?.money || 'n/a'}
              </span>
            </div>
          </div>

          {/* Source (MANDATORY) - Use sourceLabel if provided */}
          <div style={{
            fontFamily: 'Roboto',
            fontSize: 10,
            fontWeight: 900,
            textTransform: 'uppercase',
            color: colors.source,
            opacity: 0.8,
            marginTop: 4,
            textAlign: 'left',
          }}>
            {source ? (
              <a
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                {sourceLabel || 'SOURCE.'}
              </a>
            ) : (
              sourceLabel || 'SOURCE.'
            )}
          </div>
        </div>
      </div>
    )
  }

  // Card-Standard: Full-card journey color, image panel with Unsplash pipeline, no-image = category h4
  if (variant === 'card-standard') {
  const journeyBg = journey ? `var(--color-j-${journey})` : 'var(--color-purple)'
  const showCategoryInPanel = useColorFallback || (currentImageSrc && !imageLoaded)

  return (
    <div
      className="card card-standard"
      onClick={onClick}
      onTouchStart={(e) => {
        if (onClick) e.stopPropagation()
      }}
      onTouchEnd={(e) => {
        if (onClick) {
          e.stopPropagation()
          onClick()
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: journeyBg,
        borderRadius: 60,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
        {/* IMAGE — Unsplash 800x600?keyword; border matches card for seamless block; no-image = category h4 center */}
        <div
          className="card-standard-image-container"
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: journeyBg,
            border: 'none',
          }}
        >
          {currentImageSrc ? (
            <img
              key={`${imageStrike}-${journey}`}
              src={currentImageSrc}
              alt=""
              className="card-standard-image"
              onError={handleImageError}
              onLoad={handleImageLoad}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : null}
          {useColorFallback && journey && (
            <div
              className="card-standard-image"
              style={{
                position: 'absolute',
                inset: 0,
                background: getJourneyColorHex(journey),
              }}
              aria-hidden
            />
          )}
          {/* No-image fallback: category name in center (h4). While image loads, show overlay until onLoad. */}
          {showCategoryInPanel && journey && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: useColorFallback ? 1 : 1,
                transition: 'opacity 0.2s ease',
                pointerEvents: 'none',
              }}
            >
              <h4
                style={{
                  fontFamily: 'Roboto',
                  fontSize: 40,
                  fontWeight: 900,
                  lineHeight: 'var(--zz-lh-heading)',
                  letterSpacing: '-2px',
                  textTransform: 'lowercase',
                  color: 'var(--color-yellow)',
                }}
              >
                {category || journey}
              </h4>
            </div>
          )}
          {/* Badge — top-left */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              height: 30,
              padding: '0 12px',
              borderRadius: 15,
              background: 'color-mix(in srgb, var(--color-yellow) 25%, var(--color-purple))',
              fontFamily: 'Roboto',
              fontSize: 10,
              fontWeight: 900,
              textTransform: 'uppercase',
              color: 'var(--color-yellow)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {category || 'home'}
          </div>
        </div>

        {/* Arrow — bottom-right of card wrapper (aligns with text container padding) */}
        <div
          className="card-standard-arrow-overlay"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--color-purple)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 4L10 8L6 12"
              stroke="var(--color-yellow)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* TEXT — Vibrant panel: journey color background + .text-on-color (ICE) for legibility */}
        <div
          className={`card-standard-body text-on-color${journey ? '' : ''}`}
          style={{
            padding: 20,
            paddingBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            textAlign: 'left',
            background: journey ? `var(--color-j-${journey})` : 'var(--color-purple)',
          }}
        >
          {title && (
            <h4 className="card-title-slot card-standard-title text-on-color">
              {title ?? ''}
            </h4>
          )}

          <div className="card-standard-data text-on-color" style={{ display: 'flex', gap: 20, textAlign: 'left', marginBottom: source ? 4 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span className="text-label" style={{ fontFamily: 'Roboto', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', lineHeight: '14px', textAlign: 'left' }}>
                CARBON
              </span>
              <span className="text-data" style={{ textAlign: 'left' }}>
                {data?.carbon || 'n/a'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span className="text-label" style={{ fontFamily: 'Roboto', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', lineHeight: '14px', textAlign: 'left' }}>
                SAVE
              </span>
              <span className="text-data" style={{ textAlign: 'left' }}>
                {data?.money || 'n/a'}
              </span>
            </div>
          </div>

          <div className="text-on-color" style={{ marginBottom: 20 }}>
            {source ? (
              <a
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="card-standard-source text-on-color"
                onClick={(e) => e.stopPropagation()}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {sourceLabel || 'SOURCE.'}
              </a>
            ) : (
              <span className="card-standard-source">{sourceLabel || 'SOURCE.'}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Card-Liked: Liked Card (Same as compact, always DEEP bg, ICE text/data)
  if (variant === 'card-liked') {
    return (
      <div
        className="card"
        onClick={onClick}
        onTouchStart={(e) => {
          if (onClick) {
            e.stopPropagation()
          }
        }}
        onTouchEnd={(e) => {
          if (onClick) {
            e.stopPropagation()
            onClick()
          }
        }}
        style={{
          width: '100%',
          padding: 20,
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          paddingBottom: 20, // Normal padding (no extra space needed)
          borderRadius: 40,
          background: colors.background,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          minHeight: 'auto',
          maxHeight: 'none', // Allow content to expand (cards may be taller to fit text)
        }}
      >
        {/* Top Row: Badge only (no arrow) */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          marginBottom: 4,
        }}>
          {/* Category Badge */}
          <div style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 15,
            background: colors.badgeBg,
            fontFamily: 'Roboto',
            fontSize: 10,
            fontWeight: 900,
            textTransform: 'uppercase',
            color: colors.badgeText,
            display: 'inline-flex',
            alignItems: 'center',
            lineHeight: '14px',
            letterSpacing: 0,
          }}>
            {category || 'home'}
          </div>
        </div>

        {title && (
          <h4
            className="card-title-slot"
            style={{
              color: colors.title,
            }}
          >
            {title ?? ''}
          </h4>
        )}
        {subtitle && (
          <p style={{
            fontFamily: 'Roboto',
            fontSize: 16,
            fontWeight: 400,
            lineHeight: '24px',
            textTransform: 'lowercase',
            color: colors.title,
            margin: 0,
            opacity: 0.8,
            whiteSpace: 'pre-line', // Allow line breaks in subtitle
          }}>
            {subtitle}
          </p>
        )}
        
        {/* Data Row (2 Columns) - Carbon first, Money second - Always show labels */}
        <div style={{
          display: 'flex',
          gap: 20,
          marginTop: 4,
        }}>
          {/* Carbon Column (FIRST) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            <span style={{
              fontFamily: 'Roboto',
              fontSize: 10,
              fontWeight: 900,
              textTransform: 'uppercase',
              color: colors.label,
              lineHeight: '14px',
              letterSpacing: 0,
            }}>
              CARBON
            </span>
            <span className="text-data" style={{
              color: colors.carbonValue,
            }}>
              {data?.carbon || 'n/a'}
            </span>
          </div>
          
          {/* Money Column (SECOND) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            <span style={{
              fontFamily: 'Roboto',
              fontSize: 10,
              fontWeight: 900,
              textTransform: 'uppercase',
              color: colors.label,
              lineHeight: '14px',
              letterSpacing: 0,
            }}>
              SAVE
            </span>
            <span className="text-data" style={{
              color: colors.moneyValue,
            }}>
              {data?.money || 'n/a'}
            </span>
          </div>
        </div>
        
        {/* Source - Use sourceLabel if provided */}
        <div style={{
          fontFamily: 'Roboto',
          fontSize: 10,
          fontWeight: 900,
          textTransform: 'uppercase',
          color: colors.source,
          opacity: 0.8,
          marginTop: 4,
        }}>
          {source ? (
            <a
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {sourceLabel || 'SOURCE.'}
            </a>
          ) : (
            sourceLabel || 'SOURCE.'
          )}
        </div>
        
        {children}
      </div>
    )
  }

  // Card-Compact: Compact Card (Text Only)
  // Colors already computed in getCardColors above
  return (
    <div
      className="card card-compact"
      onClick={onClick}
      onTouchStart={(e) => {
        e.stopPropagation()
      }}
      onTouchEnd={(e) => {
        e.stopPropagation()
        if (onClick) {
          onClick()
        }
      }}
      style={{
        width: '100%',
        padding: 20,
        borderRadius: 40,
        background: colors.background,
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        gap: 4,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        textAlign: 'left',
      }}
    >
      {/* Top Row: Badge + Arrow */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        {/* Category Badge */}
        <div style={{
          height: 30,
          padding: '0 12px',
          borderRadius: 15,
          background: colors.badgeBg,
          fontFamily: 'Roboto',
          fontSize: 10,
          fontWeight: 900,
          textTransform: 'uppercase',
          color: colors.badgeText,
          display: 'inline-flex',
          alignItems: 'center',
          lineHeight: '14px',
          letterSpacing: 0,
        }}>
          {category || 'home'}
        </div>

        {/* Arrow CTA */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: colors.arrowBg || COLORS.ACCENT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke={colors.arrowColor || COLORS.ON_DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {title && (
        <h4
          className="card-title-slot"
          style={{
            color: colors.title,
            textAlign: 'left',
          }}
        >
          {title ?? ''}
        </h4>
      )}
      
      {/* Data Row (2 Columns) - Carbon first, Money second - Always show labels */}
      <div style={{
        display: 'flex',
        gap: 20,
        marginTop: 4,
        textAlign: 'left',
      }}>
        {/* Carbon Column (FIRST) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          textAlign: 'left',
        }}>
          <span style={{
            fontFamily: 'Roboto',
            fontSize: 10,
            fontWeight: 900,
            textTransform: 'uppercase',
            color: colors.label,
            lineHeight: '14px',
            letterSpacing: 0,
            textAlign: 'left',
          }}>
            CARBON
          </span>
          <span className="text-data" style={{
            color: colors.carbonValue,
            textAlign: 'left',
          }}>
            {data?.carbon || 'n/a'}
          </span>
        </div>
        
        {/* Money Column (SECOND) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          textAlign: 'left',
        }}>
          <span style={{
            fontFamily: 'Roboto',
            fontSize: 10,
            fontWeight: 900,
            textTransform: 'uppercase',
            color: colors.label,
            lineHeight: '14px',
            letterSpacing: 0,
            textAlign: 'left',
          }}>
            SAVE
          </span>
          <span className="text-data" style={{
            color: colors.moneyValue,
            textAlign: 'left',
          }}>
            {data?.money || 'n/a'}
          </span>
        </div>
      </div>
      
      {/* Source - Use sourceLabel if provided */}
      <div style={{
        fontFamily: 'Roboto',
        fontSize: 10,
        fontWeight: 900,
        textTransform: 'uppercase',
        color: colors.label,
        opacity: 0.8,
        marginTop: 4,
        textAlign: 'left',
      }}>
        {source ? (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            {sourceLabel || 'SOURCE.'}
          </a>
        ) : (
          sourceLabel || 'SOURCE.'
        )}
      </div>
      
      {children}
    </div>
  )
}
