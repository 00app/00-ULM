#!/usr/bin/env node
/**
 * Free disk used by local dev/build caches (safe to delete; regenerated on next dev/build).
 * Run: npm run purge:disk
 */
import { existsSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

const TARGETS = [
  '.next',
  'node_modules/.cache',
  '.eslintcache',
  'playwright-report',
  'coverage',
  'out',
]

function dirSizeMb(path) {
  try {
    const st = statSync(path)
    if (!st.isDirectory()) return (st.size / 1024 / 1024).toFixed(1)
  } catch {
    return null
  }
  return null
}

let freed = 0
for (const rel of TARGETS) {
  const abs = join(root, rel)
  if (!existsSync(abs)) continue
  try {
    const before = statSync(abs)
    if (before.isDirectory()) {
      // rough hint only
      freed += 1
    }
    rmSync(abs, { recursive: true, force: true })
    console.log(`removed ${rel}`)
  } catch (err) {
    console.warn(`skip ${rel}:`, err instanceof Error ? err.message : err)
  }
}

console.log(
  freed > 0
    ? 'purge complete — restart with npm run dev:clean'
    : 'nothing to purge (paths already absent)'
)
