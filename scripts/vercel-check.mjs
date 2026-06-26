#!/usr/bin/env node
/**
 * CI lint/typecheck entry — invoked by vercel-build-gate.mjs and `npm run lint:ci` / `typecheck:ci`.
 * Do not add package.json scripts named `lint` or `typecheck` (Vercel native checks flake).
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const mode = process.argv[2]
if (mode !== 'lint' && mode !== 'typecheck') {
  console.error('Usage: node scripts/vercel-check.mjs <lint|typecheck>')
  process.exit(1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Lint/tsc must not inherit build heap flags (vercel.json NODE_OPTIONS) — avoids flaky checks on 8GB runners. */
function verifyEnv() {
  const env = { ...process.env }
  delete env.NODE_OPTIONS
  return env
}

function run(cmd, args, opts = {}) {
  const env = opts.env ?? verifyEnv()
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, env, ...opts })
  return r.status ?? 1
}

const ESLINT_PATHS = ['app', 'lib', 'proxy.ts', 'instrumentation.ts']

function ensureDeps() {
  const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
  const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  if (existsSync(eslintBin) && existsSync(tscBin)) return 0
  if (process.env.VERCEL === '1' || process.env.CI === 'true') {
    console.error(
      '→ vercel-check: eslint/tsc missing after install — ensure installCommand is npm ci --include=dev'
    )
    return 1
  }
  console.log('→ vercel-check: installing dependencies (npm ci --include=dev)…')
  return run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'])
}

function runLint() {
  const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
  const code = run(process.execPath, [eslintBin, '--max-warnings', '0', ...ESLINT_PATHS])
  if (code === 0) console.log(`✓ eslint: ${ESLINT_PATHS.join(' ')} (0 warnings)`)
  return code
}

function runTypecheck() {
  const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
  const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const typegenCode = existsSync(nextBin)
    ? run(process.execPath, [nextBin, 'typegen'])
    : run('npm', ['exec', '--', 'next', 'typegen'])
  if (typegenCode !== 0) return typegenCode
  const tscCode = run(process.execPath, [
    tscBin,
    '--noEmit',
    '--incremental',
    '-p',
    path.join(root, 'tsconfig.typecheck.json'),
  ])
  if (tscCode === 0) console.log('✓ tsc: tsconfig.typecheck.json')
  return tscCode
}

const installCode = ensureDeps()
if (installCode !== 0) process.exit(installCode)

process.exit(mode === 'lint' ? runLint() : runTypecheck())
