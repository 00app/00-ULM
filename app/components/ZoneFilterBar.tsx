'use client'

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  activeFilterCount,
  isFiltering,
  toggleCategory,
  toggleGoal,
  togglePace,
  type FacetCounts,
  type ZoneFilterState,
} from '@/lib/zone/filters'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'

type Props = {
  state: ZoneFilterState
  counts: FacetCounts
  /** Browsable ideas on the page with no filter applied. */
  totalAll: number
  onChange: (next: ZoneFilterState) => void
  onClear: () => void
}

function Chip({
  label,
  count,
  active,
  disabled,
  removable,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  disabled?: boolean
  removable?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`zone-chip${active ? ' zone-chip--active' : ''}${removable ? ' zone-chip--removable' : ''}`}
      aria-pressed={active}
      aria-label={removable ? `${label}, remove filter` : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{label}</span>
      {typeof count === 'number' ? <span className="zone-chip-count">{count}</span> : null}
      {removable ? (
        <span className="zone-chip-x" aria-hidden="true">
          ✕
        </span>
      ) : null}
    </button>
  )
}

/** The goal + effort pairs, shared by the desktop inline groups and the mobile sheet. */
function FacetGroups({ state, counts, onChange, size }: { state: ZoneFilterState; counts: FacetCounts; onChange: Props['onChange']; size: 'inline' | 'sheet' }) {
  const goalOff = (k: 'money' | 'carbon') => counts.goal[k] === 0 && state.goal !== k
  const paceOff = (k: 'now' | 'long') => counts.pace[k] === 0 && state.pace !== k
  return (
    <>
      <div className={`zone-seg zone-seg--${size}`} role="group" aria-label="Goal">
        <Chip label="Saves money" count={counts.goal.money} active={state.goal === 'money'} disabled={goalOff('money')} onClick={() => onChange(toggleGoal(state, 'money'))} />
        <Chip label="Cuts carbon" count={counts.goal.carbon} active={state.goal === 'carbon'} disabled={goalOff('carbon')} onClick={() => onChange(toggleGoal(state, 'carbon'))} />
      </div>
      <div className={`zone-seg zone-seg--${size}`} role="group" aria-label="Effort">
        <Chip label="Do now" count={counts.pace.now} active={state.pace === 'now'} disabled={paceOff('now')} onClick={() => onChange(togglePace(state, 'now'))} />
        <Chip label="Long term" count={counts.pace.long} active={state.pace === 'long'} disabled={paceOff('long')} onClick={() => onChange(togglePace(state, 'long'))} />
      </div>
    </>
  )
}

/**
 * Bottom sheet for the secondary filters (goal, effort) below desktop width. Changes apply live,
 * so the counts on the buttons stay true; the primary button just closes with the live total.
 */
function FilterSheet({
  open,
  onClose,
  state,
  counts,
  onChange,
  onClear,
}: { open: boolean; onClose: () => void } & Omit<Props, 'totalAll'>) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Focus the dialog itself: a screen reader announces it, and Tab starts inside it.
    ref.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="zone-sheet-backdrop" onClick={onClose} data-testid="zone-filter-sheet-backdrop">
      <div
        ref={ref}
        className="zone-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        data-testid="zone-filter-sheet"
      >
        <span className="zone-sheet-grab" aria-hidden="true" />
        <div className="zone-sheet-head">
          <h3 className="m-0">Filters</h3>
          <button type="button" className="zone-filterbar-clear" onClick={onClear} disabled={!isFiltering(state)}>
            Clear all
          </button>
        </div>
        <FacetGroups state={state} counts={counts} onChange={onChange} size="sheet" />
        <button type="button" className="zone-sheet-done" onClick={onClose}>
          {counts.total === 0 ? 'No matches' : counts.total === 1 ? 'Show 1 result' : `Show ${counts.total} results`}
        </button>
      </div>
    </div>,
    document.body
  )
}

function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </svg>
  )
}

/**
 * Sticky, app-style filter bar.
 *  - Below desktop: one compact row — a Filters button (goal + effort in a bottom sheet, with a badge
 *    for how many are on) beside a single scrolling row of category chips. Active goal/effort
 *    filters also appear as removable chips so nothing is hidden behind the sheet.
 *  - Desktop: the same chips plus the goal and effort groups inline.
 * Counts are faceted, so a chip never promises results it can't deliver; empty ones are disabled.
 */
export const ZoneFilterBar = forwardRef<HTMLDivElement, Props>(function ZoneFilterBar(
  { state, counts, totalAll, onChange, onClear },
  ref
) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [stuck, setStuck] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const filtering = isFiltering(state)
  const secondary = (state.goal ? 1 : 0) + (state.pace ? 1 : 0)

  // Pinned at the top, the bar has to keep clear of the fixed Likes / Profile buttons; at rest it
  // can use the full width. Checked on scroll (passive, one frame at a time).
  useEffect(() => {
    let raf = 0
    const check = () => {
      raf = 0
      const top = barRef.current?.getBoundingClientRect().top ?? 1
      setStuck(top <= 0.5)
    }
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  // A newly applied goal / effort chip appears at the start of the row: show it.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 })
  }, [state.goal, state.pace])

  const setBarRefs = useCallback(
    (node: HTMLDivElement | null) => {
      barRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node
    },
    [ref]
  )

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
    triggerRef.current?.focus()
  }, [])

  return (
    <div ref={setBarRefs} className="zone-filterbar" role="region" aria-label="Filter ideas" data-testid="zone-filterbar" data-stuck={stuck ? 'true' : 'false'}>
      <div className="zone-filterbar-inner">
        <button
          ref={triggerRef}
          type="button"
          className={`zone-filters-trigger${secondary > 0 ? ' zone-filters-trigger--on' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
          data-testid="zone-filters-trigger"
        >
          <SlidersIcon />
          <span>Filters</span>
          {secondary > 0 ? <span className="zone-filters-badge">{secondary}</span> : null}
        </button>
        <div ref={scrollerRef} className="zone-chip-scroller" role="group" aria-label="Category">
          {state.goal ? (
            <Chip label={state.goal === 'money' ? 'Saves money' : 'Cuts carbon'} active removable onClick={() => onChange(toggleGoal(state, state.goal as 'money' | 'carbon'))} />
          ) : null}
          {state.pace ? (
            <Chip label={state.pace === 'now' ? 'Do now' : 'Long term'} active removable onClick={() => onChange(togglePace(state, state.pace as 'now' | 'long'))} />
          ) : null}
          <Chip label="All" count={state.goal || state.pace ? counts.total : totalAll} active={!state.category} onClick={() => onChange({ ...state, category: null })} />
          {counts.categories.map(({ category, count }) => (
            <Chip
              key={category}
              label={formatZoneCategoryLabel(category)}
              count={count}
              active={state.category === category}
              disabled={count === 0 && state.category !== category}
              onClick={() => onChange(toggleCategory(state, category))}
            />
          ))}
        </div>
      </div>
      <div className="zone-filterbar-inline">
        <FacetGroups state={state} counts={counts} onChange={onChange} size="inline" />
        {filtering ? (
          <button type="button" className="zone-filterbar-clear" onClick={onClear}>
            Clear{activeFilterCount(state) > 1 ? ` all (${activeFilterCount(state)})` : ''}
          </button>
        ) : null}
      </div>
      <FilterSheet open={sheetOpen} onClose={closeSheet} state={state} counts={counts} onChange={onChange} onClear={onClear} />
    </div>
  )
})
