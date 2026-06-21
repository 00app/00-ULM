/**
 * CI gate — mechanical-truth invariants (no DB).
 * Run: npm run test:mechanical-truth
 */
import { runMechanicalTruthEval } from '../lib/zone/mechanicalTruthEval'

const { ok, failures } = runMechanicalTruthEval()

if (!ok) {
  console.error('[mechanical-truth] FAILED')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}

console.log('[mechanical-truth] OK — 11 checks passed')
