#!/usr/bin/env node
/**
 * Local final-test checklist — disk purge + verify + optional full browser reset.
 * Run: node scripts/reset-local-app.mjs
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: false })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.log('━━━ 00-00 local reset ━━━\n')
run('node', ['scripts/purge-dev-artifacts.mjs'])
run('node', ['scripts/run-typecheck.mjs'])
console.log(`
Browser reset (pick one):
  • Settings → RESET DATA (full factory reset → intro)
  • DevTools → Application → Clear site data for 127.0.0.1:3000

Partial loop/journey cache (keep profile):
  npm run clear:learning

Then:
  npm run dev:clean
  → http://127.0.0.1:3000
`)
