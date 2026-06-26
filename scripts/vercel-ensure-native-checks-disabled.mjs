#!/usr/bin/env node
/**
 * Guard: Vercel Native Deployment Checks auto-bind to package.json scripts named
 * `lint` and `typecheck` and run them in parallel with the build — they flake
 * with "failed unexpectedly" while vercel-build-gate.mjs already verified the code.
 *
 * Use lint:ci / typecheck:ci only. Real checks: vercel-build-gate + GitHub Actions.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const scripts = pkg.scripts ?? {}

const forbidden = ['lint', 'typecheck']
let failed = false

for (const name of forbidden) {
  if (typeof scripts[name] === 'string') {
    console.error(`❌ package.json must NOT define "${name}" script.`)
    console.error(
      `   Vercel Native Deployment Checks bind to that name and fail with "failed unexpectedly".`
    )
    console.error(`   Use "${name}:ci" instead (runs scripts/vercel-check.mjs).`)
    failed = true
  }
}

const lintCi = scripts['lint:ci']
const typecheckCi = scripts['typecheck:ci']
if (typeof lintCi !== 'string' || !lintCi.includes('scripts/vercel-check.mjs')) {
  console.error('❌ package.json must define lint:ci → node scripts/vercel-check.mjs lint')
  failed = true
}
if (typeof typecheckCi !== 'string' || !typecheckCi.includes('scripts/vercel-check.mjs')) {
  console.error('❌ package.json must define typecheck:ci → node scripts/vercel-check.mjs typecheck')
  failed = true
}

if (failed) {
  console.error('')
  console.error('See docs/DEPLOY-VERCEL.md — disable native Lint/Typecheck in Vercel dashboard.')
  process.exit(1)
}

console.log('✓ Native lint/typecheck script names absent from package.json.')
console.log('  Real gate: vercel-build-gate.mjs + GitHub Actions Lint/Typecheck (lint:ci / typecheck:ci).')
