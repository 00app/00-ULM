'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ZoneRecCard } from '@/app/components/ZoneRecCard'
import { railDomId, type ZoneRail, type ZoneRailsLayout } from '@/lib/zone/rails'
import type { RecCardCta, RecCardModel } from '@/lib/zone/recCard'
import { ROUTES } from '@/lib/routes'

type Props = {
  layout: ZoneRailsLayout
  /** Sticky filter bar, rendered first. */
  filterBar?: ReactNode
  /** Shown instead of results when a filter matches nothing. */
  onClearFilters?: () => void
  visitedIds?: ReadonlySet<string>
  onOpen: (card: RecCardModel) => void
  onCta?: (card: RecCardModel, cta: RecCardCta) => void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Rail({ rail, visitedIds, onOpen, onCta, onClearFilters }: { rail: ZoneRail } & Omit<Props, 'layout' | 'filterBar'>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    measure()
    const el = scrollerRef.current
    if (!el) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [measure, rail.cards.length])

  const page = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const headingId = `${railDomId(rail.id)}-title`
  if (rail.kind === 'results') {
    return (
      <section id={railDomId(rail.id)} className="zone-results" data-testid="zone-results" aria-labelledby={headingId}>
        <div className="zone-results-head">
          <h3 id={headingId} className="zone-rail-title m-0">
            {rail.title}
          </h3>
          <span className="zone-results-count" role="status" aria-live="polite">
            {rail.cards.length === 1 ? '1 result' : `${rail.cards.length} results`}
          </span>
        </div>
        {rail.cards.length === 0 ? (
          <div className="zone-results-empty" data-testid="zone-results-empty">
            <p className="m-0">Nothing matches those filters.</p>
            {onClearFilters ? (
              <button type="button" className="entry-text-link" onClick={onClearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="zone-results-grid">
            {rail.cards.map((card) => (
              <div key={card.id} className="zone-results-item">
                <ZoneRecCard card={card} visited={visitedIds?.has(card.id)} onOpen={onOpen} onCta={onCta} />
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }
  return (
    <section
      id={railDomId(rail.id)}
      className={`zone-rail${rail.kind === 'hero' ? ' zone-rail--hero' : ''}`}
      data-testid={rail.kind === 'hero' ? 'zone-hero-card' : `zone-rail-${rail.id}`}
      aria-labelledby={headingId}
    >
      <div className="zone-rail-head">
        <h3 id={headingId} className="zone-rail-title m-0">
          {rail.title}
        </h3>
        {rail.kind === 'hero' ? (
          <Link href={ROUTES.SETTINGS} className="zone-rail-profile-link">
            Your profile
          </Link>
        ) : null}
        <div className="zone-rail-arrows" aria-hidden={false}>
          <button
            type="button"
            className="zone-rail-arrow"
            aria-label={`Scroll ${rail.title} left`}
            disabled={!canPrev}
            onClick={() => page(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="zone-rail-arrow"
            aria-label={`Scroll ${rail.title} right`}
            disabled={!canNext}
            onClick={() => page(1)}
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="zone-rail-scroller"
        role="region"
        aria-label={rail.ariaLabel}
        tabIndex={0}
        onScroll={measure}
      >
        {rail.cards.map((card) => (
          <div key={card.id} className={`zone-rail-item zone-rail-item--${card.size}`}>
            <ZoneRecCard
              card={card}
              visited={visitedIds?.has(card.id)}
              onOpen={onOpen}
              onCta={onCta}
              emphasis={rail.kind === 'hero' ? 'hero' : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Zone rails: Biggest savings, Today, one rail per category (≥2 cards). Horizontal scroll-snap,
 * peeking next card on mobile, arrow buttons on desktop, no auto-advance. Category pills jump to
 * their rail; they do not filter.
 */
export function ZoneRails({ layout, filterBar, onClearFilters, visitedIds, onOpen, onCta }: Props) {
  const hasContent = layout.rails.length > 0
  if (!hasContent) {
    return (
      <div className="zone-rails zone-rails--empty" data-testid="zone-rails-empty">
        <p className="m-0">Tell us your postcode and we&apos;ll show what applies to your home.</p>
        <Link href={ROUTES.START} className="entry-text-link">
          Add your postcode
        </Link>
      </div>
    )
  }

  const heroRails = layout.rails.filter((r) => r.kind === 'hero')
  const otherRails = layout.rails.filter((r) => r.kind !== 'hero')
  return (
    <div className="zone-rails" data-testid="zone-rails">
      {heroRails.map((rail) => (
        <Rail key={rail.id} rail={rail} visitedIds={visitedIds} onOpen={onOpen} onCta={onCta} />
      ))}
      {filterBar}
      {otherRails.map((rail) => (
        <Rail key={rail.id} rail={rail} visitedIds={visitedIds} onOpen={onOpen} onCta={onCta} onClearFilters={onClearFilters} />
      ))}
    </div>
  )
}
