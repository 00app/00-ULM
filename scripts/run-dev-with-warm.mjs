#!/usr/bin/env node
/**
 * Start Next dev (webpack) and warm /api/health, /, /zone in the background.
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const port = String(process.env.PORT || process.env.DEV_PORT || '3000')
const devUrl = (process.env.DEV_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '')
const env = {
  ...process.env,
  NEXT_DEV: '1',
  WATCHPACK_POLLING: '1',
  CHOKIDAR_USEPOLLING: 'true',
  PORT: port,
  DEV_URL: devUrl,
}

const warm = spawn(process.execPath, [join(root, 'scripts/warm-dev-routes.mjs')], {
  cwd: root,
  env,
  stdio: 'inherit',
})
warm.unref()

const manifestGuard = spawn(
  process.execPath,
  [join(root, 'scripts/ensure-dev-manifests.js'), '--watch'],
  { cwd: root, env, stdio: 'ignore' }
)
manifestGuard.unref()

const nextBin = join(root, 'node_modules/.bin/next')
const dev = spawn(process.execPath, [nextBin, 'dev', '--webpack', '-H', '127.0.0.1', '-p', port], {
  cwd: root,
  env,
  stdio: 'inherit',
})

dev.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})

process.on('SIGINT', () => dev.kill('SIGINT'))
process.on('SIGTERM', () => dev.kill('SIGTERM'))
