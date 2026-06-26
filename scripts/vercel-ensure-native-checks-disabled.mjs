#!/usr/bin/env node
/**
 * Align package.json with Vercel Native Deployment Checks.
 *
 * Vercel runs scripts named `lint` and `typecheck` in parallel with the build when
 * those checks are enabled in project settings. They must invoke vercel-check.mjs
 * directly (not nested npm) so NODE_OPTIONS from vercel.json build heap is not inherited.
 *
 * Real serial gate: vercel-build-gate.mjs + GitHub Actions Lint/Typecheck.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const scripts = pkg.scripts ?? {}

const vercelCheck = 'node scripts/vercel-check.mjs'
let failed = false

function expectScript(name, mode) {
  const expected = `${vercelCheck} ${mode}`
  const actual = scripts[name]
  if (actual !== expected) {
    console.error(`❌ package.json scripts.${name} must be exactly:`)
    console.error(`   "${expected}"`)
    if (actual) console.error(`   found: "${actual}"`)
    failed = true
  }
}

expectScript('lint', 'lint')
expectScript('typecheck', 'typecheck')

for (const name of ['lint:ci', 'typecheck:ci']) {
  const mode = name.replace(':ci', '')
  const expected = `${vercelCheck} ${mode}`
  if (scripts[name] !== expected) {
    console.error(`❌ package.json scripts.${name} must be "${expected}"`)
    failed = true
  }
}

if (failed) {
  console.error('')
  console.error('See docs/DEPLOY-VERCEL.md — native + GitHub deployment checks.')
  process.exit(1)
}

console.log('✓ Native deployment check scripts aligned (lint / typecheck → vercel-check.mjs).')
console.log('  Serial gate: vercel-build-gate.mjs + GitHub Actions Lint/Typecheck.')
