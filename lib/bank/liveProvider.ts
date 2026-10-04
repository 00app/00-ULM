import type {
  BankAccount,
  BankConnection,
  BankDataProvider,
  BankDateRange,
  BankTransaction,
} from '@/lib/bank/types'

/**
 * Live open-banking provider — NOT IMPLEMENTED. No live provider calls are made anywhere yet.
 *
 * TODO(provider): choose between TrueLayer, Yapily and GoCardless (cost, UK coverage, AISP
 * agency terms), then implement this class against that provider's AIS API:
 *  - connect(): create the consent / link token, redirect the user to their bank, handle the
 *    callback, store ONLY the opaque consent id server-side (never credentials, never raw
 *    tokens in the browser).
 *  - getAccounts(): list accounts the user consented to.
 *  - getTransactions(range): fetch + normalise to BankTransaction (integer pence, ISO dates).
 *  - disconnect(): revoke the consent upstream, then delete the stored consent id and any
 *    cached transactions.
 *  - Register the provider in getBankProvider() behind a feature flag; keep 'sample' the default.
 */
export class LiveBankProvider implements BankDataProvider {
  readonly id = 'live' as const

  async connect(): Promise<BankConnection> {
    throw new Error('LiveBankProvider is not implemented yet')
  }
  async getAccounts(): Promise<BankAccount[]> {
    throw new Error('LiveBankProvider is not implemented yet')
  }
  async getTransactions(_range: BankDateRange): Promise<BankTransaction[]> {
    throw new Error('LiveBankProvider is not implemented yet')
  }
  async disconnect(): Promise<void> {
    throw new Error('LiveBankProvider is not implemented yet')
  }
}
