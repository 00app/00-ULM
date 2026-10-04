'use client'

import SettingsBentoCard from '@/app/components/SettingsBentoCard'
import { useBankConnection } from '@/lib/hooks/useBankConnection'
import { useSwitchRecords } from '@/lib/hooks/useSwitchRecords'
import { savingsTotals } from '@/lib/bank/switchTracker'
import { SAMPLE_DATA_BADGE } from '@/lib/zone/recCard'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ROUTES } from '@/lib/routes'

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

/**
 * Settings: the permanent "Bank connection" row (connect / disconnect) and the savings tracker.
 * Tracker rule: only confirmed switches count, and sample-sourced savings are shown separately,
 * badged "Sample data", never added into the real total.
 */
export function SettingsBankSection() {
  const bank = useBankConnection()
  const records = useSwitchRecords()
  const totals = savingsTotals(records)
  const status = bank.state.status

  const headline =
    status === 'live' ? 'Connected' : status === 'sample' ? 'Connected (sample data)' : 'Not connected'

  return (
    <>
      <section className="settings-hero-section" aria-label="Savings tracker" data-testid="settings-savings-tracker">
        <div className="settings-hero-inner">
          <SettingsBentoCard
            label="Savings tracker"
            headline={`${gbp(totals.realGbp)} saved so far`}
            isHero
          >
            <div className="text-left mt-1 settings-overview-data">
              <p className="m-0" style={{ lineHeight: 1.45 }}>
                {totals.realCount === 0
                  ? 'Confirmed switches from your own accounts will add up here.'
                  : `From ${totals.realCount} confirmed ${totals.realCount === 1 ? 'switch' : 'switches'}, per year.`}
              </p>
              {totals.sampleCount > 0 ? (
                <p className="m-0 mt-2" style={{ lineHeight: 1.45 }} data-testid="settings-sample-savings">
                  {gbp(totals.sampleGbp)} a year from {totals.sampleCount} sample{' '}
                  {totals.sampleCount === 1 ? 'switch' : 'switches'}.{' '}
                  <span className="zone-rec-badge" style={{ display: 'inline-block' }}>
                    {SAMPLE_DATA_BADGE}
                  </span>
                </p>
              ) : null}
            </div>
          </SettingsBentoCard>
        </div>
      </section>

      <section className="settings-cards-section" aria-label="Bank connection" data-testid="settings-bank-connection">
        <div className="settings-answer-grid">
          <div className="settings-card-cell settings-card-cell--wide">
            <SettingsBentoCard label="Bank connection" headline={headline}>
              <div className="flex flex-col items-start gap-2 mt-2">
                <p className="m-0" style={{ lineHeight: 1.45 }}>
                  {status === 'none'
                    ? 'Connect to see your real savings, not estimates. Nothing is stored except that you connected.'
                    : status === 'sample'
                      ? 'Showing a sample account so you can see how it works.'
                      : 'Your bills are being read from your bank.'}
                </p>
                {status === 'none' ? (
                  <button
                    type="button"
                    className="zone-rec-cta"
                    onClick={() => {
                      trackFunnelEvent('cta_click', { page: ROUTES.SETTINGS, cta_label: 'connect_bank' })
                      void bank.connect()
                    }}
                  >
                    Connect
                  </button>
                ) : (
                  <button
                    type="button"
                    className="zone-rec-cta zone-rec-cta--secondary"
                    onClick={() => {
                      trackFunnelEvent('cta_click', { page: ROUTES.SETTINGS, cta_label: 'disconnect_bank' })
                      void bank.disconnect()
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </SettingsBentoCard>
          </div>
        </div>
      </section>
    </>
  )
}
