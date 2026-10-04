/**
 * Open banking data layer — provider-agnostic.
 * The rest of the app only ever sees these types; which provider fills them (sample today,
 * TrueLayer / Yapily / GoCardless later) is decided in one place (`getBankProvider`).
 */

export type BankConnectionStatus = 'none' | 'sample' | 'live'

export type BankAccount = {
  id: string
  name: string
  kind: 'current' | 'savings' | 'credit'
  currency: 'GBP'
}

export type BankTransaction = {
  id: string
  accountId: string
  /** ISO date (YYYY-MM-DD) the money moved. */
  date: string
  /** Integer pence. Negative = money out, positive = money in. Integers avoid float drift. */
  amountPence: number
  /** Raw bank description, e.g. "BRITISH GAS DD REF 4821". */
  description: string
}

export type BankDateRange = { from: Date; to: Date }

export type BankConnection = {
  /** Which kind of data this connection produces. */
  source: Exclude<BankConnectionStatus, 'none'>
  connectedAt: string
}

export interface BankDataProvider {
  readonly id: Exclude<BankConnectionStatus, 'none'>
  connect(): Promise<BankConnection>
  getAccounts(): Promise<BankAccount[]>
  getTransactions(range: BankDateRange): Promise<BankTransaction[]>
  disconnect(): Promise<void>
}

/** Where a figure derived from bank data came from. UI shows "Sample data" for `sample`. */
export type BankFigureSource = 'sample' | 'live'
