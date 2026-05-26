#!/usr/bin/env node
/**
 * Ensures minimal `.next/server` manifests exist so `next dev` / `next start` do not
 * throw ENOENT on font / server-reference manifests during early boot.
 *
 * Do NOT pre-write `middleware-manifest.json` — an empty stub can desync from
 * `middleware.js` and trigger "Cannot find the middleware module" while proxy compiles.
 * Next writes the real manifest under `.next/dev/server` (dev) or `.next/server` (build).
 *
 * All dev/start flows should run this first (`npm run dev` does). Prefer `npm run dev`
 * over bare `next dev`.
 */
const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const nextDir = path.join(cwd, '.next')
const distDir = path.join(nextDir, 'server')
const devServerDir = path.join(nextDir, 'dev', 'server')

const manifests = {
  'next-font-manifest.json': '{}',
  'font-manifest.json': '[]',
  'server-reference-manifest.json': JSON.stringify({ node: {}, edge: {} }, null, 0),
}

function isEmptyMiddlewareManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return true
  const mw = manifest.middleware
  const hasMw = mw && typeof mw === 'object' && Object.keys(mw).length > 0
  const sorted = Array.isArray(manifest.sortedMiddleware) ? manifest.sortedMiddleware : []
  return !hasMw && sorted.length === 0
}

/** Drop stale empty middleware manifests when the compiled module is absent. */
function removeStaleMiddlewareManifest(serverDir) {
  const manifestPath = path.join(serverDir, 'middleware-manifest.json')
  const middlewarePath = path.join(serverDir, 'middleware.js')
  if (!fs.existsSync(manifestPath) || fs.existsSync(middlewarePath)) return
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    if (isEmptyMiddlewareManifest(manifest)) {
      fs.unlinkSync(manifestPath)
    }
  } catch {
    fs.unlinkSync(manifestPath)
  }
}

if (!fs.existsSync(nextDir)) fs.mkdirSync(nextDir, { recursive: true })
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })

for (const [name, content] of Object.entries(manifests)) {
  const p = path.join(distDir, name)
  if (!fs.existsSync(p)) fs.writeFileSync(p, content, 'utf8')
}

removeStaleMiddlewareManifest(distDir)
if (fs.existsSync(devServerDir)) {
  removeStaleMiddlewareManifest(devServerDir)
}

const serverRefManifest = path.join(distDir, 'server-reference-manifest.json')
if (!fs.existsSync(serverRefManifest)) {
  console.error('ensure-dev-manifests: failed to create server-reference-manifest.json')
  process.exit(1)
}
