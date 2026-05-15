/**
 * Sum £ / kg from Neon `users.user_genome` (Hermes `savings_wins` + legacy `savings` rows).
 * Used by summary handoff and `/api/summary`.
 */

import type { HermesSavingsWin } from '@/lib/agents/hermes-memory'

function readNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function sumHermesWins(wins: HermesSavingsWin[]): { money: number; carbon: number } {
  let money = 0
  let carbon = 0
  for (const w of wins) {
    money += readNumber(w.money_gbp)
    carbon += readNumber(w.carbon_kg)
  }
  return { money, carbon }
}

/** Aggregate savings stored in `user_genome` JSONB (Hermes memory + optional legacy `savings` array). */
export function sumSavingsFromUserGenome(userGenome: unknown): {
  totalMoney: number
  totalCarbon: number
} {
  if (!userGenome || typeof userGenome !== 'object' || Array.isArray(userGenome)) {
    return { totalMoney: 0, totalCarbon: 0 }
  }
  const g = userGenome as Record<string, unknown>
  let money = 0
  let carbon = 0

  const hermes = g.hermes_memory
  if (hermes && typeof hermes === 'object' && !Array.isArray(hermes)) {
    const hm = hermes as Record<string, unknown>
    const wins = Array.isArray(hm.savings_wins) ? (hm.savings_wins as HermesSavingsWin[]) : []
    const fromHermes = sumHermesWins(wins)
    money += fromHermes.money
    carbon += fromHermes.carbon
  }

  if (Array.isArray(g.savings)) {
    for (const row of g.savings) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      money += readNumber(r.money_gbp ?? r.money ?? r.savings ?? r.amount_gbp)
      carbon += readNumber(r.carbon_kg ?? r.carbon ?? r.co2_kg)
    }
  }

  return {
    totalMoney: Math.max(0, Math.round(money)),
    totalCarbon: Math.max(0, Math.round(carbon)),
  }
}
