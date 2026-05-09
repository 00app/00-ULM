export type PulseMetric = {
  state: 'online' | 'offline' | 'skipped'
  latencyMs?: number
  detail?: string
}
