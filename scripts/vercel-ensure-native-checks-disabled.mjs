#!/usr/bin/env node
/**
 * Guard: package.json must NOT define `lint` or `typecheck` scripts.
 *
 * Vercel Native Deployment Checks auto-bind those names and run them in parallel
 * with the build — they often fail with "failed unexpectedly" while
 * vercel-build-gate.mjs already verified the same code serially.
 *
 * Real gates: vercel-build-gate.mjs (build) + GitHub Actions Lint/Typecheck (lint:ci / typecheck:ci).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const scripts = pkg.scripts ?? {}

const vercelCheck = 'node scripts/vercel-check.mjs'
let failed = false

for (const forbidden of ['lint', 'typecheck']) {
  if (scripts[forbidden]) {
    console.error(`❌ package.json must NOT define scripts.${forbidden}.`)
    console.error(`   Vercel Native Deployment Checks bind to that name and flake in parallel with build.`)
    console.error(`   Use scripts.${forbidden}:ci and GitHub Actions instead.`)
    failed = true
  }
}

function expectCiScript(name, mode) {
  const expected = `${vercelCheck} ${mode}`
  const actual = scripts[name]
  if (actual !== expected) {
    console.error(`❌ package.json scripts.${name} must be exactly:`)
    console.error(`   "${expected}"`)
    if (actual) console.error(`   found: "${actual}"`)
    failed = true
  }
}

expectCiScript('lint:ci', 'lint')
expectCiScript('typecheck:ci', 'typecheck')

if (failed) {
  console.error('')
  console.error('See docs/DEPLOY-VERCEL.md — disable native Lint/Typecheck in Vercel dashboard; require GitHub Actions.')
  process.exit(1)
}

console.log('✓ Native check script names disabled (no lint/typecheck in package.json).')
console.log('  Serial gate: vercel-build-gate.mjs + GitHub Actions lint:ci / typecheck:ci.')
