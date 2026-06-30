#!/usr/bin/env node
/**
 * Explain why Vercel Build Logs can be green while dashboard Lint/Typecheck show red.
 * Validates repo guardrails and prints the one-time dashboard fix.
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const scripts = pkg.scripts ?? {}

const FORBIDDEN = ['lint', 'typecheck', 'type-check', 'check-types']
const foundForbidden = FORBIDDEN.filter((name) => scripts[name])

function section(title) {
  console.log('')
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`)
}

function ok(msg) {
  console.log(`✓ ${msg}`)
}

function warn(msg) {
  console.log(`⚠ ${msg}`)
}

function fail(msg) {
  console.log(`✗ ${msg}`)
}

console.log('00-ULM — Vercel lint/typecheck diagnostic')
console.log('')

section('Why dashboard checks fail while Build Logs are green')
console.log(`
Vercel runs TWO independent gates on every deploy:

  1. BUILD COMMAND (serial)     vercel.json → vercel-build-gate.mjs
     typecheck → lint → next build
     Your 09:28 log shows this layer: ✓ verify passed

  2. DEPLOYMENT CHECKS (parallel)   Vercel dashboard → Settings → Deployment Checks
     Separate jobs that run alongside the build — NOT shown in Build Logs.
     Can fail with "internal error" / "failed unexpectedly" even when (1) passed.

This repo intentionally avoids package.json scripts named lint/typecheck so
Vercel native checks auto-skip. If native Lint/Typecheck are still listed as
REQUIRED in the dashboard (added manually or from an older config), the deploy
stays Staged and www.00-00.online may not update until checks pass or you promote.
`.trim())

section('Repo guardrails')
if (foundForbidden.length === 0) {
  ok('No forbidden script names (lint, typecheck, type-check, check-types)')
} else {
  fail(`Remove package.json scripts: ${foundForbidden.join(', ')}`)
  console.log('  Native Deployment Checks bind to those exact names and flake in parallel.')
}

const lintCi = scripts['lint:ci']
const typecheckCi = scripts['typecheck:ci']
if (lintCi === 'node scripts/vercel-check.mjs lint') ok('lint:ci → vercel-check.mjs')
else fail(`lint:ci must be "node scripts/vercel-check.mjs lint" (found: ${lintCi ?? 'missing'})`)

if (typecheckCi === 'node scripts/vercel-check.mjs typecheck') ok('typecheck:ci → vercel-check.mjs')
else fail(`typecheck:ci must be "node scripts/vercel-check.mjs typecheck" (found: ${typecheckCi ?? 'missing'})`)

section('Local verify (same gate as Vercel build)')
const verify = spawnSync('npm', ['run', 'typecheck:ci'], { cwd: root, stdio: 'inherit', shell: true })
if (verify.status === 0) ok('typecheck:ci passed locally')
else {
  fail('typecheck:ci failed — fix before deploy')
  process.exit(verify.status ?? 1)
}

const lint = spawnSync('npm', ['run', 'lint:ci'], { cwd: root, stdio: 'inherit', shell: true })
if (lint.status === 0) ok('lint:ci passed locally')
else {
  fail('lint:ci failed — fix before deploy')
  process.exit(lint.status ?? 1)
}

section('One-time dashboard fix (stops recurring red checks)')
console.log(`
1. Vercel → project 00-ulm → Settings → Build and Deployment → Deployment Checks
2. REMOVE required native "Lint" and "Typecheck" (Next 16 + flat ESLint → internal error)
3. ADD GitHub Actions checks — job names must match exactly:
     • Lint       (.github/workflows/vercel-production-gate.yml)
     • Typecheck  (same workflow)
4. GitHub → repo Settings → Secrets → VERCEL_TOKEN_00
   (enables .github/workflows/promote-production.yml auto-promote)
`.trim())

section('After every green build')
console.log(`
• npm run deploy     — verify locally + remote build + auto-promote www
• npm run promote    — assign latest Ready deployment if dashboard still Staged

Build Logs green + Checks Failed = dashboard config, not bad code.
See docs/DEPLOY-VERCEL.md
`.trim())

console.log('')
