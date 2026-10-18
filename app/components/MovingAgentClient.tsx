'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import { SecondaryCircleCta } from '@/app/components/ui/SecondaryCircleCta'
import { PROFILE_STORAGE_KEYS } from '@/lib/profile/onboardingComplete'
import { isValidUkPostcode } from '@/lib/geocode/ukPostcode'
import { ROUTES } from '@/lib/routes'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import type { FirstResultInsight } from '@/lib/entry/firstResult'
import {
  MOVING_AUDIENCE_PREFIX,
  MOVING_GROUPS,
  MOVING_GROUP_ORDER,
  MOVING_KNOWLEDGE_VERIFIED,
  movingTasksFor,
  resolveTaskTitle,
  tipsFor,
  type MovingTask,
  type Nation,
} from '@/lib/zoneAgents/moving/knowledge'
import { markJustMoved, readMovedAt } from '@/lib/zoneAgents/moving/movedState'

type AgentData = {
  postcode: string
  place: string | null
  council: string | null
  nation: Nation | null
  insights: FirstResultInsight[]
  signedIn: boolean
  progress: Record<string, boolean>
}

const LOCAL_PROGRESS_KEY = 'zz_moving_tasks_v1'

function readLocalProgress(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY)
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    return Object.fromEntries(Object.entries(v).filter(([, d]) => d === true)) as Record<string, boolean>
  } catch {
    return {}
  }
}

function writeLocalProgress(p: Record<string, boolean>) {
  try {
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(p))
  } catch {
    /* storage blocked */
  }
}

const VERIFIED_LABEL = new Date(`${MOVING_KNOWLEDGE_VERIFIED}T00:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * Moving Home agent results: the new place played back, live figures for it, then every task to
 * sort after a move, grouped by urgency, each with the official link, tips and a source. Progress
 * is kept locally for everyone and saved to household_moves for signed-in users.
 */
export function MovingAgentClient() {
  const [postcode, setPostcode] = useState<string | null>(null)
  const [data, setData] = useState<AgentData | null>(null)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let pc = ''
    try {
      pc = localStorage.getItem(PROFILE_STORAGE_KEYS.postcode)?.trim() ?? ''
    } catch {
      /* storage blocked */
    }
    setProgress(readLocalProgress())
    if (!isValidUkPostcode(pc)) {
      setPostcode('')
      return
    }
    setPostcode(pc)
    markJustMoved()
    trackFunnelEvent('cta_click', { page: '/agents/moving', cta_label: 'agent_open_moving' })
    const ctrl = new AbortController()
    fetch(`/api/agents/moving?postcode=${encodeURIComponent(pc)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<AgentData>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setData(d)
        // Server progress wins for signed-in users; local ticks made as a guest are kept too.
        if (d.signedIn) setProgress((local) => ({ ...local, ...d.progress }))
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== 'AbortError') setFailed(true)
      })
    return () => ctrl.abort()
  }, [])

  const tasks = useMemo(() => movingTasksFor(data?.nation ?? null), [data?.nation])
  const doneCount = tasks.filter((t) => progress[t.id]).length

  const toggle = useCallback(
    (task: MovingTask) => {
      const done = !progress[task.id]
      const next = { ...progress }
      if (done) next[task.id] = true
      else delete next[task.id]
      setProgress(next)
      writeLocalProgress(next)
      if (data?.signedIn && postcode) {
        void fetch('/api/agents/moving', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, done, postcode, movedAt: readMovedAt() }),
        }).catch(() => {})
      }
    },
    [progress, data?.signedIn, postcode]
  )

  if (postcode === '') {
    return (
      <div className="agent-page">
        <ZoneBackToZoneLink />
        <h3 className="zz-page-title">Moving in</h3>
        <p className="agent-intro">Add your new postcode and we&apos;ll build your moving-in list.</p>
        <SecondaryCircleCta ariaLabel="Add your postcode" href={ROUTES.START}>
          ADD
          <br />
          POSTCODE
        </SecondaryCircleCta>
      </div>
    )
  }

  const place = data?.place || postcode
  return (
    <div className="agent-page" data-testid="agent-moving">
      <ZoneBackToZoneLink />
      <h3 className="zz-page-title">Moving in</h3>
      <p className="agent-intro">
        {place ? `Welcome to ${place}. ` : ''}Here&apos;s everything to sort after a move, in order.
      </p>
      <p className="agent-progress" aria-live="polite">
        {doneCount} of {tasks.length} done
      </p>
      <div
        className="agent-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={tasks.length}
        aria-valuenow={doneCount}
      >
        <span style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }} />
      </div>
      {data && !data.signedIn ? (
        <p className="agent-note">
          Your ticks are saved on this device.{' '}
          <a href={`${ROUTES.PROFILE}?entry=create`} className="agent-link">
            Create an account
          </a>{' '}
          to keep them everywhere.
        </p>
      ) : null}

      {data && data.insights.length > 0 ? (
        <section className="agent-group" aria-label={`${place} right now`}>
          <h4 className="agent-group__title">{place} right now</h4>
          <ul className="agent-insights">
            {data.insights.map((i) => (
              <li key={i.category}>
                <span className="agent-insights__line">{i.sentence}</span>
                <span className="agent-source">Source: {i.source}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!data && !failed ? <p className="agent-note">Checking {postcode}…</p> : null}

      {MOVING_GROUP_ORDER.map((g) => {
        const groupTasks = tasks.filter((t) => t.group === g)
        if (groupTasks.length === 0) return null
        return (
          <section key={g} className="agent-group" aria-labelledby={`agent-group-${g}`}>
            <h4 id={`agent-group-${g}`} className="agent-group__title">
              {MOVING_GROUPS[g].title}
            </h4>
            <p className="agent-group__blurb">{MOVING_GROUPS[g].blurb}</p>
            <ul className="agent-tasks">
              {groupTasks.map((task) => {
                const done = Boolean(progress[task.id])
                return (
                  <li key={task.id} className={`agent-task${done ? ' agent-task--done' : ''}`} data-task={task.id}>
                    <button
                      type="button"
                      className="agent-task__check"
                      aria-pressed={done}
                      aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${resolveTaskTitle(task, data?.council)}`}
                      onClick={() => toggle(task)}
                    >
                      {done ? '✓' : ''}
                    </button>
                    <div className="agent-task__body">
                      {task.audience ? (
                        <span className="agent-task__audience">{MOVING_AUDIENCE_PREFIX[task.audience]}</span>
                      ) : null}
                      <p className="agent-task__title">{resolveTaskTitle(task, data?.council)}</p>
                      <p className="agent-task__why">{task.why}</p>
                      <a
                        className="zone-rec-cta agent-task__action"
                        href={task.action.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          trackFunnelEvent('cta_click', { page: '/agents/moving', cta_label: `moving_${task.id}` })
                        }
                      >
                        {task.action.label}
                      </a>
                      {tipsFor(task, data?.nation ?? null).length > 0 ? (
                        <ul className="agent-task__tips">
                          {tipsFor(task, data?.nation ?? null).map((tip) => (
                            <li key={tip.text}>
                              {tip.text}{' '}
                              <a className="agent-source agent-link" href={tip.source.url} target="_blank" rel="noopener noreferrer">
                                {tip.source.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="agent-source">
                        Source:{' '}
                        <a className="agent-link" href={task.source.url} target="_blank" rel="noopener noreferrer">
                          {task.source.name}
                        </a>
                        , checked {VERIFIED_LABEL}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
