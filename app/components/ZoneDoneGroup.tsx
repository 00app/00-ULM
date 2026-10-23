'use client'

import { useId, useState } from 'react'
import type { ActionCompletion, ZoneAction } from '@/lib/actions/actionTypes'
import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'

type DoneRow = { action: ZoneAction; completedAt: string }

/**
 * Library actions this person has marked done, kept out of the way at the end of the rails.
 *
 * Progressive disclosure: one collapsed line ("Done (3) · £560 a year") until opened, then a
 * compact list with Undo. Done items no longer compete with open ones for attention, but they
 * stay visible, so the person can see what they have achieved and reverse a mis-tap.
 *
 * The total adds only figures the library can source (`valueGbp` with a `source`), matching the
 * mechanical truth rule: nothing estimated or unknown is counted, and nothing shows as £0.
 */
export function ZoneDoneGroup({
  completions,
  onUndo,
}: {
  completions: ActionCompletion[]
  onUndo: (actionId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()

  const rows: DoneRow[] = completions
    .map((c) => {
      const action = ZONE_ACTIONS.find((a) => a.id === c.actionId)
      return action ? { action, completedAt: c.completedAt } : null
    })
    .filter((r): r is DoneRow => r !== null)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))

  if (rows.length === 0) return null

  const sourcedGbp = rows.reduce(
    (sum, r) => (r.action.source && r.action.valueGbp && r.action.valueGbp > 0 ? sum + r.action.valueGbp : sum),
    0
  )
  const summary = `Done (${rows.length})${sourcedGbp > 0 ? ` · £${sourcedGbp.toLocaleString('en-GB')} a year` : ''}`

  return (
    <section className="zone-done-group" aria-label="Done">
      <button
        type="button"
        className="zone-done-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="zone-done-toggle__label">{summary}</span>
        <span className="zone-done-toggle__hint">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <ul id={listId} className="zone-done-list">
          {rows.map(({ action }) => (
            <li key={action.id} className="zone-done-row">
              <span className="zone-done-row__tick" aria-hidden="true">
                ✓
              </span>
              <span className="zone-done-row__text">
                <span className="zone-done-row__title">{action.action}</span>
                {action.source && action.valueGbp && action.valueGbp > 0 ? (
                  <span className="zone-done-row__meta">
                    £{action.valueGbp.toLocaleString('en-GB')} a year · {action.source}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className="zone-done-row__undo"
                aria-label={`Undo: ${action.action}`}
                onClick={() => onUndo(action.id)}
              >
                Undo
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
