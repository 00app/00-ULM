#!/usr/bin/env node
/**
 * Smoke-check Discovery / ZeroHunter HTTP surfaces (no auth secrets in repo).
 * Usage: node scripts/verify-agents.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.AGENT_TEST_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const authToken = process.env.GATEWAY_TOKEN || ''

async function main() {
  const grid = await fetch('https://api.carbonintensity.org.uk/intensity', { signal: AbortSignal.timeout(8000) })
  console.log('[grid] carbonintensity.org.uk', grid.ok ? 'OK' : `FAIL ${grid.status}`)

  const pulseHeaders = {}
  if (authToken) pulseHeaders.Authorization = `Bearer ${authToken}`

  const pulse = await fetch(`${base}/api/agents/pulse`, {
    method: 'GET',
    signal: AbortSignal.timeout(8000),
    headers: pulseHeaders,
  })
  const pulseBody = await pulse.text()
  console.log('[pulse]', base, pulse.status, pulseBody.slice(0, 120))

  const zone = await fetch(`${base}/zone`, { signal: AbortSignal.timeout(8000) })
  console.log('[zone]', zone.status)

  const pulseOk = authToken ? pulse.ok : pulse.ok || pulse.status === 401
  if (!grid.ok || !zone.ok || !pulseOk) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
