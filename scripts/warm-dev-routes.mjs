#!/usr/bin/env node
/**
 * Pre-compile hot routes after `next dev` boots (especially after purge:disk).
 * Run in the background from scripts/run-dev-with-warm.mjs — do not block the dev server.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const base = (process.env.DEV_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const root = join(import.meta.dirname, '..')
const middlewareManifest = join(root, '.next/dev/server/middleware-manifest.json')
const paths = ['/api/health', '/', '/zone']

async function waitReady(maxMs = 180_000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (!existsSync(middlewareManifest)) {
      await new Promise((r) => setTimeout(r, 500))
      continue
    }
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) return true
    } catch {
      // server still compiling manifests / proxy
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  return false
}

async function warm() {
  if (!(await waitReady())) {
    console.warn(`[warm-dev] timed out waiting for ${base}/api/health — open the app once the terminal shows Ready`)
    return
  }
  console.log(`[warm-dev] warming ${paths.join(', ')} (first compile after purge can take a few minutes)…`)
  for (const path of paths) {
    const t0 = Date.now()
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(600_000) })
      console.log(`[warm-dev] ${path} → ${res.status} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    } catch (err) {
      console.warn(`[warm-dev] ${path} failed:`, err instanceof Error ? err.message : err)
    }
  }
  console.log(`[warm-dev] done — open ${base} in the browser (if Next picked another port, match DEV_URL to the Local URL in the dev log)`)
}

warm().catch((err) => {
  console.warn('[warm-dev] error:', err instanceof Error ? err.message : err)
})
