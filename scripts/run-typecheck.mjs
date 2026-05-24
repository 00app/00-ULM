#!/usr/bin/env node
/**
 * Typecheck entry — ignores extra argv (npm forwards pasted "# comment" tokens to scripts).
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tsc = path.join(root, 'node_modules/typescript/bin/tsc')

const result = spawnSync(
  process.execPath,
  [tsc, '--noEmit', '-p', path.join(root, 'tsconfig.typecheck.json')],
  { stdio: 'inherit', cwd: root }
)

process.exit(result.status ?? 1)
