import { AsyncLocalStorage } from 'node:async_hooks'
import { CRON_LLM_SCOPE_GLOBAL_KEY } from '@/lib/intelligence/scrapeBoundaries'

/**
 * Server-only half of the cron-only LLM exception (see isZoneResearchCronLlmEnabled in
 * scrapeBoundaries.ts). Kept out of scrapeBoundaries because that module is pulled into client
 * bundles, where node:async_hooks does not exist.
 */
const scope = new AsyncLocalStorage<true>()

;(globalThis as Record<string, unknown>)[CRON_LLM_SCOPE_GLOBAL_KEY] = () => scope.getStore() === true

/** Run `fn` with the cron-only LLM exception in scope. */
export function runWithCronLlmScope<T>(fn: () => Promise<T>): Promise<T> {
  return scope.run(true, fn)
}
