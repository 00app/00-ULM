#!/usr/bin/env node
/**
 * Typecheck entry — same gate as CI (`next typegen` + tsc). Ignores extra argv.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vercelCheck = path.join(root, 'scripts', 'vercel-check.mjs')

const result = spawnSync(process.execPath, [vercelCheck, 'typecheck'], {
  stdio: 'inherit',
  cwd: root,
})

process.exit(result.status ?? 1)
