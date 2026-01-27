'use client'

import React from 'react'
import { getJourneyImage } from '@/lib/content/images'
import { JourneyId } from '@/lib/journeys'

/**
 * COLOR SYSTEM - Semantic color decisions (LOCKED)
 * All color logic lives here, not in CSS or Zone
 */
const COLORS = {
  BLUE: '#000AFF',      // Carbon impact (primary signal)
  DEEP: '#141268',      // Money / finance
  COOL: '#F8F8FE',      // Neutral / informational surfaces
  ICE: '#FDFDFF',       // Text on dark backgrounds
  PINK: '#E80DAD',      // Completion state only
} as const

/**
 * Get semantic colors for a card variant
 * Returns all color decisions based on variant and intent
 */
function getCardColors(
  variant: 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked',
  tone?: 'cool' | 'blue'
) {
  if (variant === 'card-hero') {
    // Hero: Carbon-first, BLUE data panel, ICE text
    return {
      background: COLORS.BLUE,
      title: COLORS.ICE,
      subtitle: COLORS.ICE,
      carbonValue: COLORS.ICE,
      moneyValue: COLORS.ICE,
      label: COLORS.ICE,
      source: COLORS.ICE,
      badgeBg: COLORS.COOL,
      badgeText: COLORS.DEEP,
    }
  }

  if (variant === 'card-standard') {
    // Standard: COOL body, BLUE carbon, DEEP money, DEEP title (default)
    return {
      background: COLORS.COOL,
      title: COLORS.DEEP, // DEEP by default (BLUE if explicitly carbon-led - future enhancement)
      carbonValue: COLORS.BLUE,
      moneyValue: COLORS.DEEP,
      label: COLORS.DEEP,
      source: COLORS.DEEP,
      badgeBg: COLORS.COOL,
      badgeText: COLORS.DEEP,
    }
  }

  if (variant === 'card-liked') {
    // Liked: DEEP background, ICE text
    return {
      background: COLORS.DEEP,
      title: COLORS.ICE,
      carbonValue: COLORS.ICE,
      moneyValue: COLORS.ICE,
      label: COLORS.ICE,
      source: COLORS.ICE,
      badgeBg: COLORS.COOL,
      badgeText: COLORS.DEEP,
    }
  }

  // card-compact
  if (tone === 'blue') {
    // Carbon-led: BLUE background, ICE text
    return {
      background: COLORS.BLUE,
      title: COLORS.ICE,
      carbonValue: COLORS.ICE,
      moneyValue: COLORS.ICE,
      label: COLORS.ICE,
      source: COLORS.ICE,
      badgeBg: COLORS.COOL,
      badgeText: COLORS.DEEP,
      arrowBg: COLORS.BLUE,
      arrowColor: COLORS.ICE,
    }
  }

  // card-compact, tone='cool' (neutral)
  return {
    background: COLORS.COOL,
    title: COLORS.DEEP,
    carbonValue: COLORS.BLUE,  // Carbon always BLUE
    moneyValue: COLORS.DEEP,   // Money always DEEP
    label: COLORS.DEEP,
    source: COLORS.DEEP,
    badgeBg: COLORS.COOL,
    badgeText: COLORS.DEEP,
    arrowBg: COLORS.BLUE,
    arrowColor: COLORS.ICE,
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
  tone?: 'cool' | 'blue'
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
export default function Card({ variant, children, onClick, image, journey, title, subtitle, tone = 'cool', category, source, sourceLabel, data }: CardProps) {
  // LOCKED: Only 4 variants allowed
  const allowedVariants = ['card-hero', 'card-standard', 'card-compact', 'card-liked'] as const
  if (!allowedVariants.includes(variant as any)) {
    console.error(`[Card] Invalid variant "${variant}". Must be one of: ${allowedVariants.join(', ')}`)
    return null
  }

  // Image resolution logic (LOCKED):
  // 1. card-liked and card-compact NEVER render images
  // 2. Use image prop ONLY if it's a valid non-null string
  // 3. ALWAYS fallback to journey-based resolution if journey exists (even if image is null)
  // 4. Return null if no image (CSS handles with COOL background)
  const resolvedImage =
    variant === 'card-liked' || variant === 'card-compact'
      ? null // NEVER render images on compact/liked cards
      : image != null && typeof image === 'string' && image.length > 0
        ? image
        : journey
          ? getJourneyImage(journey, variant, 0)
          : null

  // Validation: Settings page must NOT render images
  if (variant === 'card-liked' && resolvedImage) {
    console.error(`[Card] card-liked variant must NOT render images. Image: ${resolvedImage}`)
  }

  // Dev-time assertion: Warn if hero/standard cards are missing images
  if ((variant === 'card-hero' || variant === 'card-standard') && !resolvedImage && journey) {
    console.warn(`[Card] Missing image for ${variant} (journey: ${journey}). Expected path: /cards/${journey}/${variant === 'card-hero' ? 'hero' : 'standard'}.jpg`)
  }

  // Log resolved image path for debugging
  if (process.env.NODE_ENV === 'development' && resolvedImage && variant !== 'card-liked' && variant !== 'card-compact') {
    console.log(`[Card] Resolved image: ${resolvedImage} for ${variant} (journey: ${journey})`)
  }

  // Get semantic colors for this card
  const colors = getCardColors(variant, tone)

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
          ...(resolvedImage ? {
            backgroundImage: `url(${resolvedImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          } : {
            background: '#F8F8FE', // COOL fallback if no image
          }),
          cursor: onClick ? 'pointer' : 'default',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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
            background: COLORS.BLUE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke={COLORS.ICE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                CO₂ SAVING
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
                MONEY SAVING
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

  // Card-Standard (Card 2): Image + Text Below — LOCKED
  if (variant === 'card-standard') {

  return (
    <div
      className="card card-standard"
      onClick={onClick}
      onTouchStart={(e) => {
        // Ensure touch events work on mobile
        if (onClick) {
          e.stopPropagation()
        }
      }}
      onTouchEnd={(e) => {
        // Trigger onClick on touch end for mobile
        if (onClick) {
          e.stopPropagation()
          onClick()
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-cool)',
        borderRadius: 60,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
        {/* IMAGE */}
        <div
          className="card-standard-image"
            style={{
              width: '100%',
              aspectRatio: '4 / 3',
              ...(resolvedImage ? {
                backgroundImage: `url(${resolvedImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : {
                background: '#F8F8FE', // COOL fallback if no image
              }),
              position: 'relative',
              overflow: 'hidden',
            }}
        >
          {/* Badge + Arrow */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              right: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 15,
                background: '#F8F8FE',
                fontFamily: 'Roboto',
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                color: '#141268',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {category || 'home'}
            </div>

            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#000AFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 4L10 8L6 12"
                  stroke="#FDFDFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* TEXT */}
        <div
          className="card-standard-body"
          style={{
            padding: 20,
            paddingBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            textAlign: 'left',
          }}
        >
          {/* Title — locked 3-line slot, no jumping */}
          {title && (
            <h4
              className="card-title-slot card-standard-title"
            >
              {title ?? ''}
            </h4>
          )}

          {/* DATA - Tight spacing between label and value */}
          <div className="card-standard-data" style={{ display: 'flex', gap: 20, textAlign: 'left', marginBottom: source ? 4 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span
                style={{
                  fontFamily: 'Roboto',
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#141268',
                  lineHeight: '14px',
                  textAlign: 'left',
                }}
              >
                CO₂ SAVING
              </span>
              <span className="text-data" style={{ color: colors.carbonValue, textAlign: 'left' }}>
                {data?.carbon || 'n/a'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span
                style={{
                  fontFamily: 'Roboto',
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: colors.label,
                  lineHeight: '14px',
                  textAlign: 'left',
                }}
              >
                MONEY SAVING
              </span>
              <span className="text-data" style={{ color: colors.moneyValue, textAlign: 'left' }}>
                {data?.money || 'n/a'}
              </span>
            </div>
          </div>

          {/* SOURCE - Use sourceLabel if provided */}
          <div style={{ marginBottom: 20 }}>
            {source ? (
              <a
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="card-standard-source"
                onClick={(e) => e.stopPropagation()}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
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
              CO₂ SAVING
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
              MONEY SAVING
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
          background: colors.arrowBg || COLORS.BLUE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke={colors.arrowColor || COLORS.ICE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
            CO₂ SAVING
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
            MONEY SAVING
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
