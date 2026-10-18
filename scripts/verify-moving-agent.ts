/**
 * Moving Home agent: the knowledge base is advice people act on (fines, deadlines, who to tell),
 * so every task must carry a working-looking official link and a source, and the agent must only
 * switch on for someone who has just moved.
 */

import {
  MOVING_GROUP_ORDER,
  MOVING_KNOWLEDGE_VERIFIED,
  MOVING_TASKS,
  movingTasksFor,
  nationFromCountry,
  resolveTaskTitle,
  tipsFor,
} from '@/lib/zoneAgents/moving/knowledge'
import { isWithinJustMovedWindow, JUST_MOVED_WINDOW_DAYS } from '@/lib/zoneAgents/moving/movedState'
import { eligibleAgents, ZONE_AGENTS } from '@/lib/zoneAgents/registry'
import { ENERGY_SUPPLIER_JUST_MOVED, normaliseEnergySupplier } from '@/lib/profile/energySupplier'
import { cleanAreaName } from '@/lib/entry/firstResult'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []
const assert = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail })

// --- Knowledge integrity -----------------------------------------------------------------
const ids = MOVING_TASKS.map((t) => t.id)
assert('task ids are unique', new Set(ids).size === ids.length, ids.join(','))
assert('knowledge is dated', /^\d{4}-\d{2}-\d{2}$/.test(MOVING_KNOWLEDGE_VERIFIED))
assert('covers council tax, energy, water and insurance', ['council-tax', 'energy', 'water', 'home-insurance'].every((id) => ids.includes(id)))
for (const t of MOVING_TASKS) {
  assert(`${t.id}: https action`, t.action.url.startsWith('https://'), t.action.url)
  assert(`${t.id}: https source`, t.source.url.startsWith('https://'), t.source.url)
  assert(`${t.id}: named source`, t.source.name.trim().length > 2)
  assert(`${t.id}: says why`, t.why.trim().length > 20, t.why)
  assert(`${t.id}: has a nation`, t.nations.length > 0)
  assert(`${t.id}: known group`, MOVING_GROUP_ORDER.includes(t.group))
  assert(`${t.id}: no em or en dashes`, !/[–—]/.test(`${t.title} ${t.why} ${t.tips.map((x) => x.text).join(' ')}`))
  for (const tip of t.tips) {
    assert(`${t.id}: tip has https source`, tip.source.url.startsWith('https://'), tip.text)
  }
}

// --- Nation filtering --------------------------------------------------------------------
const scotland = movingTasksFor('scotland').map((t) => t.id)
assert('Scotland: no England-and-Wales water task', !scotland.includes('water'))
assert('Scotland: no England-and-Wales deposit task', !scotland.includes('deposit'))
assert('Scotland: still gets council tax', scotland.includes('council-tax'))
assert('unknown nation shows every task', movingTasksFor(null).length === MOVING_TASKS.length)
assert('England gets the GP task', movingTasksFor('england').some((t) => t.id === 'gp'))
assert('tasks come back in group order', (() => {
  const order = movingTasksFor('england').map((t) => MOVING_GROUP_ORDER.indexOf(t.group))
  return order.every((v, i) => i === 0 || v >= order[i - 1])
})())
assert('nationFromCountry maps postcodes.io names', nationFromCountry('Northern Ireland') === 'northern-ireland' && nationFromCountry('Wales') === 'wales' && nationFromCountry('') === null)

assert('England does not get the Scottish Assessors tip', !tipsFor(MOVING_TASKS.find((t) => t.id === 'council-tax')!, 'england').some((x) => /Scottish/.test(x.text)))
assert('Scotland gets the Scottish Assessors tip', tipsFor(MOVING_TASKS.find((t) => t.id === 'council-tax')!, 'scotland').some((x) => /Scottish/.test(x.text)))

// --- Council name ------------------------------------------------------------------------
const ct = MOVING_TASKS.find((t) => t.id === 'council-tax')!
assert('council name fills the title', resolveTaskTitle(ct, 'Arun') === 'Set up council tax with Arun')
assert('missing council reads naturally', resolveTaskTitle(ct, null) === 'Set up council tax with your new council')

assert('council name is cleaned: Bristol, City of', cleanAreaName('Bristol, City of') === 'Bristol')
assert('council name is cleaned: City of Edinburgh', cleanAreaName('City of Edinburgh') === 'Edinburgh')
assert('council name is cleaned: Herefordshire, County of', cleanAreaName('Herefordshire, County of') === 'Herefordshire')
assert('plain council name unchanged', cleanAreaName('Worthing') === 'Worthing')

// --- Just-moved window -------------------------------------------------------------------
const now = new Date('2026-10-18T12:00:00Z')
assert('moved today is in the window', isWithinJustMovedWindow('2026-10-18', now))
assert(`moved ${JUST_MOVED_WINDOW_DAYS - 1} days ago is in`, isWithinJustMovedWindow('2026-07-21', now))
assert('moved 120 days ago is out', !isWithinJustMovedWindow('2026-06-20', now))
assert('no date is out', !isWithinJustMovedWindow(null, now))
assert('garbage date is out', !isWithinJustMovedWindow('soon', now))

// --- Registry ----------------------------------------------------------------------------
assert('moving agent is registered', ZONE_AGENTS.some((a) => a.id === 'moving'))
assert('moving agent hidden unless just moved', eligibleAgents({ now, recentlyMoved: false }).length === 0)
assert('moving agent shown when just moved', eligibleAgents({ now, recentlyMoved: true }).some((a) => a.id === 'moving'))

// --- Supplier answer ---------------------------------------------------------------------
assert('JUST_MOVED is an unknown supplier for every calculation', normaliseEnergySupplier(ENERGY_SUPPLIER_JUST_MOVED) === '')

const failed = checks.filter((c) => !c.pass)
for (const c of failed) console.error(`✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
if (failed.length > 0) {
  console.error(`[moving-agent] FAIL — ${failed.length} of ${checks.length} checks failed`)
  process.exit(1)
}
console.log(`[moving-agent] OK — ${checks.length} checks passed`)
