#!/usr/bin/env node
/**
 * Guard: Vercel Native Deployment Checks bind to package.json scripts named
 * `lint` and `typecheck`. They must call scripts/vercel-check.mjs (direct eslint/tsc),
 * not deprecated `next lint` — Next 16 flat ESLint otherwise yields "internal error".
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const scripts = pkg.scripts ?? {}

const required = {
  lint: 'node scripts/vercel-check.mjs lint',
  typecheck: 'node scripts/vercel-check.mjs typecheck',
}

let failed = false
for (const [name, expected] of Object.entries(required)) {
  const value = scripts[name]
  if (typeof value !== 'string') {
    console.error(`❌ package.json missing "${name}" script (Vercel native ${name} check needs it).`)
    console.error(`   Add: "${name}": "${expected}"`)
    failed = true
    continue
  }
  if (value.includes('next lint') || value.trim() === 'next lint') {
    console.error(`❌ "${name}" must not call next lint (Next 16 native check crash).`)
    console.error(`   Use: "${name}": "${expected}"`)
    failed = true
    continue
  }
  if (!value.includes('scripts/vercel-check.mjs')) {
    console.error(`❌ "${name}" must call scripts/vercel-check.mjs, got: ${value}`)
    failed = true
  }
}

if (failed) {
  console.error('')
  console.error('See docs/DEPLOY-VERCEL.md — direct eslint/tsc via vercel-check.mjs.')
  process.exit(1)
}

console.log('✓ Native lint/typecheck scripts wired to scripts/vercel-check.mjs.')
console.log('  buildCommand (vercel-build-gate) + GitHub Actions Lint/Typecheck also run verify.')
