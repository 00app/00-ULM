#!/usr/bin/env node
/**
 * Ensures minimal `.next` manifests exist so `next dev` / `next start` do not
 * throw ENOENT on font / server-reference manifests during early boot.
 *
 * Dev: strips stale **production** `.next/server` output when `.next/dev` exists
 * or on every `npm run dev` — mixed prod+dev trees cause Next 16 webpack to read
 * zero-byte manifests during HMR ("Manifest file is empty", often on /zai).
 *
 * Do NOT pre-write `middleware-manifest.json` — an empty stub can desync from
 * `middleware.js` and trigger "Cannot find the middleware module" while proxy compiles.
 *
 * All dev/start flows should run this first (`npm run dev` does). Prefer `npm run dev`
 * over bare `next dev`.
 */
const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const nextDir = path.join(cwd, '.next')
const distDir = path.join(nextDir, 'server')
const devDir = path.join(nextDir, 'dev')
const devServerDir = path.join(devDir, 'server')

const lifecycle = process.env.npm_lifecycle_event ?? ''
const isDevBoot =
  process.env.NEXT_DEV === '1' ||
  lifecycle === 'dev' ||
  lifecycle === 'dev:clean' ||
  lifecycle === 'dev:3000' ||
  lifecycle === 'dev:alt' ||
  lifecycle === 'dev:open' ||
  lifecycle === 'run'

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

/** Next dev requires this file to exist once `middleware.js` is compiled (`require()` in next-server). */
function ensureMiddlewareManifest(serverDir) {
  const manifestPath = path.join(serverDir, 'middleware-manifest.json')
  const middlewarePath = path.join(serverDir, 'middleware.js')
  if (!fs.existsSync(middlewarePath) || fs.existsSync(manifestPath)) return
  const stub = JSON.stringify({ version: 3, sortedMiddleware: [], middleware: {}, functions: {} })
  fs.writeFileSync(manifestPath, stub, 'utf8')
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

/** Zero-byte manifest .js/.json files break evalManifest with "Manifest file is empty". */
function removeZeroByteManifestFiles(serverDir) {
  if (!fs.existsSync(serverDir)) return
  for (const name of fs.readdirSync(serverDir)) {
    if (!name.includes('manifest')) continue
    const p = path.join(serverDir, name)
    try {
      const st = fs.statSync(p)
      if (st.isFile() && st.size === 0) {
        fs.unlinkSync(p)
        console.log(`ensure-dev-manifests: removed zero-byte ${path.relative(cwd, p)}`)
      }
    } catch {
      /* ignore */
    }
  }
}

function isActiveDevTree() {
  return isDevBoot || fs.existsSync(devServerDir)
}

/** Production `next build` output must not coexist with `next dev` (Next 16 webpack). */
function stripStaleProductionArtifactsForDev() {
  if (!isActiveDevTree()) return

  const prodAppDir = path.join(distDir, 'app')
  const hasProdServer = fs.existsSync(prodAppDir) || fs.existsSync(distDir)
  const hasDevTree = fs.existsSync(devServerDir)

  if (hasProdServer && hasDevTree) {
    try {
      fs.rmSync(distDir, { recursive: true, force: true })
      console.log('ensure-dev-manifests: removed stale .next/server (production build)')
    } catch (err) {
      console.warn('ensure-dev-manifests: could not remove .next/server:', err?.message ?? err)
    }
  }

  if (hasDevTree) {
    for (const name of [
      'BUILD_ID',
      'build-manifest.json',
      'react-loadable-manifest.json',
      'app-path-routes-manifest.json',
      'prerender-manifest.json',
      'routes-manifest.json',
      'export-marker.json',
    ]) {
      const p = path.join(nextDir, name)
      if (!fs.existsSync(p)) continue
      try {
        fs.unlinkSync(p)
      } catch {
        /* ignore */
      }
    }
  }
}

function seedManifests(serverDir) {
  if (!fs.existsSync(serverDir)) fs.mkdirSync(serverDir, { recursive: true })
  for (const [name, content] of Object.entries(manifests)) {
    const p = path.join(serverDir, name)
    if (!fs.existsSync(p)) fs.writeFileSync(p, content, 'utf8')
  }
}

function runBootPass() {
  stripStaleProductionArtifactsForDev()

  const devActive = isActiveDevTree() && fs.existsSync(devServerDir)

  if (devActive) {
    seedManifests(devServerDir)
    ensureMiddlewareManifest(devServerDir)
    removeZeroByteManifestFiles(devServerDir)
    const serverRefManifest = path.join(devServerDir, 'server-reference-manifest.json')
    if (!fs.existsSync(serverRefManifest)) {
      console.error('ensure-dev-manifests: failed to create server-reference-manifest.json')
      process.exit(1)
    }
    return
  }

  // Fresh `next dev` boot: do not create `.next/server` — Next 16 owns `.next/dev` only.
  if (isDevBoot) return

  if (!fs.existsSync(nextDir)) fs.mkdirSync(nextDir, { recursive: true })
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })
  seedManifests(distDir)
  removeStaleMiddlewareManifest(distDir)
  removeZeroByteManifestFiles(distDir)

  const serverRefManifest = path.join(distDir, 'server-reference-manifest.json')
  if (!fs.existsSync(serverRefManifest)) {
    console.error('ensure-dev-manifests: failed to create server-reference-manifest.json')
    process.exit(1)
  }
}

/** During `next dev`, only evict production `.next/server` — never touch dev manifests (HMR races). */
function runWatchPass() {
  stripStaleProductionArtifactsForDev()
  if (fs.existsSync(devServerDir)) {
    ensureMiddlewareManifest(devServerDir)
  }
  if (fs.existsSync(distDir)) {
    removeZeroByteManifestFiles(distDir)
  }
}

if (process.argv.includes('--watch')) {
  runBootPass()
  setInterval(runWatchPass, 2000)
} else {
  runBootPass()
}
