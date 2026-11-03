#!/usr/bin/env node
/**
 * Build-time guard: on a Vercel production build, the DATABASE_URL host must match
 * MANIFEST_NEON_POOLER_HOST (lib/intelligence/manifest.ts). Nothing caught this before
 * 2026-11 because the check didn't exist: .env.local silently pointed at a different Neon
 * database than production for months (docs/PRODUCT-ROADMAP.md risk #6). Fails the build
 * loudly instead of deploying a mismatch silently.
 *
 * Only enforced when VERCEL_ENV === 'production' and DATABASE_URL is actually set at build
 * time (some setups only inject it at runtime) — never fails preview/dev/local builds.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'lib', 'intelligence', 'manifest.ts')

function readManifestHost() {
  const src = fs.readFileSync(manifestPath, 'utf8')
  const m = src.match(/MANIFEST_NEON_POOLER_HOST\s*=\s*'([^']+)'/)
  if (!m) throw new Error('Could not read MANIFEST_NEON_POOLER_HOST from lib/intelligence/manifest.ts')
  return m[1]
}

function hostOf(connectionString) {
  try {
    return new URL(connectionString).host || null
  } catch {
    const m = connectionString.match(/^postgres(?:ql)?:\/\/[^@]+@([^/?#]+)/i)
    return m ? m[1] : null
  }
}

function main() {
  const vercelEnv = process.env.VERCEL_ENV ?? ''
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? ''

  if (vercelEnv !== 'production') {
    console.log(`→ db-host-manifest: skipped (VERCEL_ENV=${vercelEnv || '(unset, not on Vercel)'})`)
    return
  }
  if (!databaseUrl) {
    console.log(
      '→ db-host-manifest: DATABASE_URL not set at build time, nothing to check here (runtime will fail if it is still unset)'
    )
    return
  }

  const manifestHost = readManifestHost()
  const actualHost = hostOf(databaseUrl)

  if (!actualHost) {
    console.warn('→ db-host-manifest: could not parse a host out of DATABASE_URL, skipping check')
    return
  }

  if (actualHost !== manifestHost) {
    console.error('')
    console.error('✗ DATABASE_URL host does not match MANIFEST_NEON_POOLER_HOST.')
    console.error(`  Production env DATABASE_URL host: ${actualHost}`)
    console.error(`  lib/intelligence/manifest.ts says: ${manifestHost}`)
    console.error('')
    console.error('  This is exactly the local/prod Neon mismatch documented in docs/PRODUCT-ROADMAP.md.')
    console.error('  Fix one of the two:')
    console.error('  - If this deploy SHOULD be on the new host: update MANIFEST_NEON_POOLER_HOST in')
    console.error('    lib/intelligence/manifest.ts to match, commit, and redeploy.')
    console.error('  - If the Vercel production DATABASE_URL env var is wrong: fix it in the Vercel')
    console.error('    dashboard (Settings → Environment Variables → Production) and redeploy.')
    console.error(
      '  Then resync local dev: vercel pull --yes --environment=production && cp .vercel/.env.production.local .env.local'
    )
    console.error('')
    process.exit(1)
  }

  console.log(`✓ db-host-manifest: DATABASE_URL host matches manifest (${actualHost})`)
}

main()
