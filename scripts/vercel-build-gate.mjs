#!/usr/bin/env node
/**
 * Vercel buildCommand — serial verify then next build.
 * Runs typecheck + lint without the build heap (NODE_OPTIONS cleared) so 8GB runners
 * do not OOM, then runs build-with-manifest-fix with project NODE_OPTIONS.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vercelCheck = path.join(root, 'scripts', 'vercel-check.mjs')
const buildScript = path.join(root, 'scripts', 'build-with-manifest-fix.js')

function run(cmd, args, env = process.env) {
  const code = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, env }).status ?? 1
  if (code !== 0) process.exit(code)
}

console.log('→ vercel-build-gate: typecheck')
run(process.execPath, [vercelCheck, 'typecheck'])

console.log('→ vercel-build-gate: lint')
run(process.execPath, [vercelCheck, 'lint'])

console.log('✓ verify passed — starting production build')
run(process.execPath, [buildScript], process.env)
