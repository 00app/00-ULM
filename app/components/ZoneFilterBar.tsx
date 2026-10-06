'use client'

import { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react'
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
          {isFiltering(state) ? (
            <button type="button" className="zone-filterbar-clear" onClick={onClear}>
              Clear all
            </button>
          ) : null}
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease-out' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * Category dropdown (replaces the row of 12 chips). A button that opens a listbox: arrow keys move,
 * Enter selects, Esc / outside click / Tab closes. Options carry faceted counts and are disabled
 * when they would give nothing.
 */
function CategoryMenu({
  state,
  counts,
  totalAll,
  onChange,
}: Pick<Props, 'state' | 'counts' | 'totalAll' | 'onChange'>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const listId = useId()

  const options: { value: ZoneFilterState['category']; label: string; count: number; disabled: boolean }[] = [
    { value: null, label: 'All categories', count: state.goal || state.pace ? counts.total : totalAll, disabled: false },
    ...counts.categories.map(({ category, count }) => ({
      value: category as ZoneFilterState['category'],
      label: formatZoneCategoryLabel(category),
      count,
      disabled: count === 0 && state.category !== category,
    })),
  ]
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === state.category))
  const current = options[selectedIndex]

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }, [])

  const choose = useCallback(
    (i: number) => {
      const o = options[i]
      if (!o || o.disabled) return
      onChange({ ...state, category: o.value })
      close(true)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.length, state, onChange, close]
  )

  useEffect(() => {
    if (!open) return
    setActive(selectedIndex)
    listRef.current?.focus()
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const step = (dir: 1 | -1) => {
    let i = active
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length
      if (!options[i].disabled) break
    }
    setActive(i)
  }

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active) }
    else if (e.key === 'Escape') { e.preventDefault(); close(true) }
    else if (e.key === 'Tab') close(false)
  }

  return (
    <div ref={rootRef} className="zone-menu">
      <button
        ref={buttonRef}
        type="button"
        className={`zone-menu-button${state.category ? ' zone-menu-button--on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Category: ${current.label.toLowerCase()}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true) }
        }}
        data-testid="zone-category-menu"
      >
        <span>{current.label}</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <ul
          id={listId}
          ref={listRef}
          className="zone-menu-list"
          role="listbox"
          aria-label="Category"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          data-testid="zone-category-list"
        >
          {options.map((o, i) => (
            <li
              key={o.label}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === selectedIndex}
              aria-disabled={o.disabled || undefined}
              className={`zone-menu-option${i === active ? ' zone-menu-option--active' : ''}${i === selectedIndex ? ' zone-menu-option--selected' : ''}${o.disabled ? ' zone-menu-option--off' : ''}`}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              <span className="zone-chip-count">{o.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
 *  - Every category lives in ONE dropdown (a listbox), so the bar never grows with the number of
 *    categories.
 *  - Below desktop: [Filters] (goal + effort in a bottom sheet, badge = how many are on) + the
 *    Category dropdown; active goal/effort filters also show as removable chips.
 *  - Desktop: the Category dropdown with the goal and effort groups inline beside it.
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
        <CategoryMenu state={state} counts={counts} totalAll={totalAll} onChange={onChange} />
        <div ref={scrollerRef} className="zone-active-chips" role="group" aria-label="Active filters">
          {state.goal ? (
            <Chip label={state.goal === 'money' ? 'Saves money' : 'Cuts carbon'} active removable onClick={() => onChange(toggleGoal(state, state.goal as 'money' | 'carbon'))} />
          ) : null}
          {state.pace ? (
            <Chip label={state.pace === 'now' ? 'Do now' : 'Long term'} active removable onClick={() => onChange(togglePace(state, state.pace as 'now' | 'long'))} />
          ) : null}
        </div>
        <div className="zone-filterbar-inline">
          <FacetGroups state={state} counts={counts} onChange={onChange} size="inline" />
          {filtering ? (
            <button type="button" className="zone-filterbar-clear" onClick={onClear}>
              Clear{activeFilterCount(state) > 1 ? ` all (${activeFilterCount(state)})` : ''}
            </button>
          ) : null}
        </div>
      </div>
      <FilterSheet open={sheetOpen} onClose={closeSheet} state={state} counts={counts} onChange={onChange} onClear={onClear} />
    </div>
  )
})
