#!/usr/bin/env node
/**
 * Vercel Native Deployment Checks — `npm run lint` / `npm run typecheck`.
 * Ensures deps + next-env.d.ts, uses explicit binaries (no deprecated `next lint`).
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

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, env: process.env, ...opts })
  return r.status ?? 1
}

function ensureDeps() {
  const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
  const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  if (existsSync(eslintBin) && existsSync(tscBin)) return 0
  console.log('→ vercel-check: installing dependencies (npm ci --include=dev)…')
  return run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'])
}

function runLint() {
  const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
  return run(process.execPath, [eslintBin, 'app', 'lib'])
}

function runTypecheck() {
  const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
  const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const typegenCode = existsSync(nextBin)
    ? run(process.execPath, [nextBin, 'typegen'])
    : run('npm', ['exec', '--', 'next', 'typegen'])
  if (typegenCode !== 0) return typegenCode
  return run(process.execPath, [
    tscBin,
    '--noEmit',
    '--incremental',
    '-p',
    path.join(root, 'tsconfig.typecheck.json'),
  ])
}

const installCode = ensureDeps()
if (installCode !== 0) process.exit(installCode)

process.exit(mode === 'lint' ? runLint() : runTypecheck())
