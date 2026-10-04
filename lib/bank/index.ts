import { LiveBankProvider } from '@/lib/bank/liveProvider'
import { SampleBankProvider } from '@/lib/bank/sampleProvider'
import type { BankDataProvider } from '@/lib/bank/types'

export * from '@/lib/bank/types'
export { SampleBankProvider } from '@/lib/bank/sampleProvider'
export { LiveBankProvider } from '@/lib/bank/liveProvider'

/**
 * The single place the provider is chosen. Live is a stub, so everything resolves to the sample
 * provider today; switching later is a change here only.
 */
export function getBankProvider(kind: 'sample' | 'live' = 'sample', opts: { now?: Date } = {}): BankDataProvider {
  return kind === 'live' ? new LiveBankProvider() : new SampleBankProvider(opts)
}
