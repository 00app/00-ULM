#!/usr/bin/env node
/**
 * Guard: Vercel Native Deployment Checks auto-bind to package.json scripts named
 * `lint` and `typecheck`. Those parallel runners flake ("failed unexpectedly")
 * while buildCommand already runs the same checks via vercel-build-gate.mjs.
 *
 * Keep lint:ci / typecheck:ci only — native checks skip when those names are absent.
 * GitHub Actions jobs Lint + Typecheck still satisfy Deployment Checks.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const scripts = pkg.scripts ?? {}

const nativeNames = ['lint', 'typecheck', 'type-check', 'check-types']
const found = nativeNames.filter((name) => typeof scripts[name] === 'string')

if (found.length > 0) {
  console.error('❌ Vercel native Deployment Checks will bind to these package.json scripts:')
  for (const name of found) {
    console.error(`   - "${name}"`)
  }
  console.error('')
  console.error('Rename to lint:ci / typecheck:ci (see scripts/vercel-check.mjs).')
  console.error('Dashboard: Settings → Deployment Checks → remove native Lint/Typecheck if still listed.')
  process.exit(1)
}

console.log('✓ Native check script names absent — Vercel will skip parallel lint/typecheck.')
console.log('  Verify still runs in buildCommand (vercel-build-gate) + GitHub Actions Lint/Typecheck.')
