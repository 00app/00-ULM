'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { PAGER_CARDS, PAGER_CONTACT, PAGER_DOORS, type PagerCard } from './pagerData'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import { ExpandedCardShell } from '@/app/components/ExpandedCard'
import { SoloFocusViewportUtilityStrip } from '@/app/components/SoloFocusViewportUtilityStrip'
import { SoloFocusMotherStack } from '@/app/components/SoloFocusMotherStack'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import styles from './pager.module.css'

/**
 * Interactive one-pager.
 *
 * The interaction carries the argument. Front of a card is the claim, back is the proof, and the
 * page therefore behaves the way the product does: nothing asserted without a source. Someone
 * tapping through to check where £24bn came from is not reading a pitch, they are using a
 * miniature of the thing being pitched.
 *
 * Tap-to-expand is the real Zone Solo Focus, not an approximation of it: `ExpandedCardShell`,
 * `SoloFocusViewportUtilityStrip` (close button) and `SoloFocusMotherStack` (category, headline,
 * prose, metrics layout and spacing) are the same components the live wall portals to
 * `document.body`, imported directly rather than re-styled by hand. What is NOT imported is
 * `JourneyBentoCard`/`SoloFocusOverlay` themselves (they need a real session, a `JourneyId`, and
 * live research/profile state this static page never has) or `SoloFocusJourneyNav` (its prev/next
 * logic walks the live wall's mixed mother-card/tip grid via a `JourneyId`-typed ring, over-built
 * for nine flat static cards) — those three are reimplemented below with the exact same classnames
 * driving simple array-index neighbours instead, so the look and feel stays identical while the
 * data stays a plain static array.
 */
export default function PagerClient() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const reduceMotion = useHydrationSafeReducedMotion()

  const openCard = useCallback((index: number) => {
    setExpandedIndex(index)
    setIsClosing(false)
  }, [])

  const closeCard = useCallback(() => {
    setIsClosing(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    if (isClosing) {
      setExpandedIndex(null)
      setIsClosing(false)
    }
  }, [isClosing])

  const stepCard = useCallback((delta: 1 | -1) => {
    setExpandedIndex((cur) => (cur === null ? cur : (cur + delta + PAGER_CARDS.length) % PAGER_CARDS.length))
  }, [])

  useEffect(() => {
    if (expandedIndex === null) return
    document.body.classList.add('has-solo-focus')
    return () => {
      document.body.classList.remove('has-solo-focus')
    }
  }, [expandedIndex])

  useEffect(() => {
    if (expandedIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCard()
      else if (e.key === 'ArrowRight') stepCard(1)
      else if (e.key === 'ArrowLeft') stepCard(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expandedIndex, closeCard, stepCard])

  return (
    <main className={styles.pager}>
      <header className={styles.header}>
        <Mark className={styles.logo} />
        <h1 className={styles.title}>
          UK households are owed
          <br />
          £24 billion a year.
          <br />
          Most never claim it.
        </h1>
      </header>

      <section className="groovy-zone-grid" aria-label="Zero Zero in nine facts">
        {PAGER_CARDS.map((card, index) => (
          <Card key={card.id} card={card} index={index} onOpen={openCard} />
        ))}
      </section>

      <section className={styles.doors} aria-label="What we are looking for">
        <h2 className={styles.doorsTitle}>Two doors</h2>
        <div className={styles.doorsGrid}>
          {PAGER_DOORS.map((d) => (
            <div key={d.label} className={styles.door}>
              <p className={styles.doorLabel}>{d.label}</p>
              <p className={styles.doorBody}>{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.contact}>
        <p className={styles.contactTitle}>Get in touch</p>
        <div className={styles.contactRows}>
          <a className={styles.contactLink} href={`mailto:${PAGER_CONTACT.email}`}>
            {PAGER_CONTACT.email}
          </a>
          <span className={styles.contactSite}>{PAGER_CONTACT.site}</span>
        </div>
        <p className={styles.contactName}>{PAGER_CONTACT.name}</p>
      </footer>

      {expandedIndex !== null
        ? createPortal(
            <SoloFocusPortal
              card={PAGER_CARDS[expandedIndex]!}
              isClosing={isClosing}
              reduceMotion={reduceMotion}
              onExitComplete={handleExitComplete}
              onClose={closeCard}
              onPrev={() => stepCard(-1)}
              onNext={() => stepCard(1)}
              prevLabel={PAGER_CARDS[(expandedIndex - 1 + PAGER_CARDS.length) % PAGER_CARDS.length]!.eyebrow}
              nextLabel={PAGER_CARDS[(expandedIndex + 1) % PAGER_CARDS.length]!.eyebrow}
            />,
            document.body
          )
        : null}
    </main>
  )
}

/**
 * The Zero Zero brand mark, top right of the header. Same paths as app/components/Logo.tsx's
 * static (non-animated) export, copied rather than imported so this folder stays sealed: no
 * cross-import into the rest of the app, nothing to break if Logo.tsx ever changes shape.
 */
function Mark({ className }: { className?: string }) {
  return (
    <svg width={40} viewBox="0 0 126 200" fill="none" className={className} aria-hidden>
      <path
        d="M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z"
        fill="currentColor"
      />
      <path
        d="M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z"
        fill="currentColor"
      />
      <path
        d="M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Tone → the real 3-colour cascade, via the same attribute/class combination a live card uses
 * (globals.css), not a hand-written background/colour rule: journey (default) is purple on
 * yellow text; `data-zone-surface="tip"` is pink on yellow text; adding `zone-card--discovery`
 * on top of that flips it to yellow on purple text. Three tones, zero new colour declarations.
 */
function toneAttrs(tone: PagerCard['tone']): { 'data-zone-surface'?: 'tip' | 'journey'; className?: string } {
  if (tone === 'pink') return { 'data-zone-surface': 'tip' }
  if (tone === 'yellow') return { 'data-zone-surface': 'tip', className: 'zone-card--discovery' }
  return { 'data-zone-surface': 'journey' }
}

function Card({
  card,
  index,
  onOpen,
}: {
  card: PagerCard
  index: number
  onOpen: (index: number) => void
}) {
  const tone = toneAttrs(card.tone)
  const cls = [
    'bento-card-groovy',
    styles.cardReset,
    tone.className ?? '',
    card.span === 'wide' ? 'span-wide' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={cls}
      data-zone-surface={tone['data-zone-surface']}
      onClick={() => onOpen(index)}
      aria-haspopup="dialog"
      aria-label={`${card.eyebrow}. ${card.line} Tap for the source.`}
    >
      <ZoneBentoCardHeader journeyId="home" label={card.eyebrow} />

      <span className={styles.face}>
        <h3 className="card-headline m-0 min-w-0" lang="en">
          {card.line}
        </h3>
        <span className={styles.statStack}>
          <span className="data-value data-stamp-metric">{card.figure}</span>
        </span>
      </span>

      <span className={styles.hint} aria-hidden="true">
        proof +
      </span>
    </button>
  )
}

/**
 * The real Solo Focus overlay: `.solo-focus-grow-layer` fixed full-viewport wrapper, portaled to
 * `document.body` exactly like `JourneyBentoCard`/`SoloFocusOverlay` do it, same close button,
 * same `SoloFocusMotherStack` layout. One shared instance for all nine cards (like
 * `SoloFocusOverlay`, not one instance per tile like `JourneyBentoCard`) since there is no
 * per-card mount/unmount to stage here, only which static card's data is showing.
 */
function SoloFocusPortal({
  card,
  isClosing,
  reduceMotion,
  onExitComplete,
  onClose,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  card: PagerCard
  isClosing: boolean
  reduceMotion: boolean
  onExitComplete: () => void
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
}) {
  const tone = toneAttrs(card.tone)

  return (
    <motion.div className="solo-focus-grow-layer" initial={false}>
      <ExpandedCardShell
        data-zone-surface={tone['data-zone-surface']}
        className="expanded-solo-focus view-expanded"
        reduceMotion={reduceMotion}
        isExiting={isClosing}
        onAnimationComplete={() => {
          if (isClosing) onExitComplete()
        }}
      >
        <div className="solo-focus-shell-wrap w-full min-w-0">
          <SoloFocusViewportUtilityStrip onClose={onClose} />

          <div className="solo-focus-rail w-full min-w-0">
            <div className="solo-focus-stack flex flex-col items-stretch justify-start w-full min-w-0">
              <div className="solo-focus-shell solo-focus-mother solo-focus-content-stack w-full min-w-0">
                <SoloFocusMotherStack
                  zoneCategoryLabel={card.eyebrow}
                  headline={card.line}
                  prose={
                    <div className="solo-focus-true-tip-sections solo-focus-true-tip-sections--mother flex flex-col gap-0 w-full min-w-0">
                      <p className="solo-focus-description m-0">{card.back}</p>
                      <p className="solo-focus-source-citation-footnote m-0">source. {card.source}</p>
                    </div>
                  }
                  metrics={
                    <>
                      <span className="data-value data-stamp-metric">{card.figure}</span>
                      <nav className="solo-focus-journey-nav solo-focus-journey-nav--inset" aria-label="Card navigation">
                        <button
                          type="button"
                          className="solo-focus-journey-nav__btn solo-focus-journey-nav__btn--prev"
                          onClick={onPrev}
                          aria-label={`Previous card: ${prevLabel}`}
                        >
                          <BackArrowDownLeft
                            size={18}
                            className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--prev"
                          />
                          <h4 className="solo-focus-journey-nav__label nav-label">{prevLabel}</h4>
                        </button>
                        <button
                          type="button"
                          className="solo-focus-journey-nav__btn solo-focus-journey-nav__btn--next"
                          onClick={onNext}
                          aria-label={`Next card: ${nextLabel}`}
                        >
                          <h4 className="solo-focus-journey-nav__label nav-label">{nextLabel}</h4>
                          <BackArrowDownLeft
                            size={18}
                            className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--next"
                          />
                        </button>
                      </nav>
                    </>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </ExpandedCardShell>
    </motion.div>
  )
}
