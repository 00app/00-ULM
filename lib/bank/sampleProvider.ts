import type {
  BankAccount,
  BankConnection,
  BankDataProvider,
  BankDateRange,
  BankTransaction,
} from '@/lib/bank/types'

/**
 * Realistic UK sample set: energy DD, broadband, mobile, insurance, subscriptions, plus ordinary
 * spending noise, over 12 months, with exactly one price rise (energy, +25% mid-year).
 * Deterministic for a given `now` so tests are stable. Everything derived from it is "sample".
 */

type Recurring = {
  description: string
  day: number
  /** Amount in pence by months-ago (0 = this month). */
  amountPence: (monthsAgo: number) => number
}

const flat = (pence: number) => () => pence

const RECURRING: Recurring[] = [
  // Energy: £118.00 until 6 months ago, then £148.00 (the one price rise).
  { description: 'BRITISH GAS DD REF 4821', day: 15, amountPence: (m) => (m >= 6 ? 11800 : 14800) },
  { description: 'SKY BROADBAND DD 7731', day: 3, amountPence: flat(3299) },
  { description: 'EE LIMITED DD', day: 9, amountPence: flat(2400) },
  { description: 'ADMIRAL INSURANCE DD', day: 21, amountPence: flat(4150) },
  { description: 'AVIVA HOME INS DD', day: 21, amountPence: flat(1420) },
  { description: 'NETFLIX.COM', day: 6, amountPence: flat(1099) },
  { description: 'SPOTIFY P1A2B3', day: 12, amountPence: flat(1199) },
  { description: 'AMAZON PRIME*2K4', day: 18, amountPence: flat(899) },
  { description: 'PUREGYM LTD', day: 1, amountPence: flat(1999) },
]

const NOISE_MERCHANTS = [
  'TESCO STORES 3145',
  'SAINSBURYS S/MKTS 0412',
  'TFL TRAVEL CHARGE',
  'PRET A MANGER 0021',
  'COSTA COFFEE 5512',
  'AMAZON MKTPLACE EU',
  'BOOTS 1180',
]

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isoDate(y: number, m0: number, d: number): string {
  const dt = new Date(Date.UTC(y, m0, d))
  return dt.toISOString().slice(0, 10)
}

const ACCOUNT: BankAccount = { id: 'sample-current', name: 'Sample current account', kind: 'current', currency: 'GBP' }

export class SampleBankProvider implements BankDataProvider {
  readonly id = 'sample' as const
  private connected = false
  private readonly now: Date

  constructor(opts: { now?: Date } = {}) {
    this.now = opts.now ?? new Date()
  }

  async connect(): Promise<BankConnection> {
    this.connected = true
    return { source: 'sample', connectedAt: this.now.toISOString() }
  }

  async getAccounts(): Promise<BankAccount[]> {
    this.assertConnected()
    return [ACCOUNT]
  }

  async getTransactions(range: BankDateRange): Promise<BankTransaction[]> {
    this.assertConnected()
    const all = this.generate()
    const from = range.from.toISOString().slice(0, 10)
    const to = range.to.toISOString().slice(0, 10)
    return all.filter((t) => t.date >= from && t.date <= to)
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  private assertConnected() {
    if (!this.connected) throw new Error('SampleBankProvider: connect() first')
  }

  /** 12 months of history ending today (inclusive of future-dated rows being skipped). */
  private generate(): BankTransaction[] {
    const y = this.now.getUTCFullYear()
    const m = this.now.getUTCMonth()
    const today = this.now.toISOString().slice(0, 10)
    const rand = mulberry32(y * 100 + m)
    const out: BankTransaction[] = []
    let n = 0
    const push = (date: string, amountPence: number, description: string) => {
      if (date > today) return
      n += 1
      out.push({ id: `sample-${n}`, accountId: ACCOUNT.id, date, amountPence, description })
    }
    for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
      const base = new Date(Date.UTC(y, m - monthsAgo, 1))
      const by = base.getUTCFullYear()
      const bm = base.getUTCMonth()
      push(isoDate(by, bm, 28), 235000, 'ACME LTD SALARY')
      for (const r of RECURRING) push(isoDate(by, bm, r.day), -r.amountPence(monthsAgo), r.description)
      const visits = 8 + Math.floor(rand() * 5)
      for (let i = 0; i < visits; i++) {
        const day = 1 + Math.floor(rand() * 27)
        const merchant = NOISE_MERCHANTS[Math.floor(rand() * NOISE_MERCHANTS.length)]
        const pence = 250 + Math.floor(rand() * 7500)
        push(isoDate(by, bm, day), -pence, merchant)
      }
    }
    return out.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)))
  }
}
