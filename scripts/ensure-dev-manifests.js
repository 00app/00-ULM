#!/usr/bin/env node
/**
 * Ensures .next/server has middleware-manifest.json (and other manifests)
 * so `next dev` / `next start` never throw "Cannot find module ... middleware-manifest.json".
 * Writes manifests every run so they are always present and valid before Next starts.
 * All dev/start flows must run this first (npm run dev does; do not run `next dev` alone).
 */
const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const nextDir = path.join(cwd, '.next')
const distDir = path.join(nextDir, 'server')

const manifests = {
  'middleware-manifest.json': JSON.stringify({
    sortedMiddleware: [],
    middleware: {},
    functions: {},
    matchers: [],
  }, null, 0),
  'next-font-manifest.json': '{}',
  'font-manifest.json': '[]',
  'server-reference-manifest.json': JSON.stringify({ node: {}, edge: {} }, null, 0),
}

if (!fs.existsSync(nextDir)) fs.mkdirSync(nextDir, { recursive: true })
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })

// Ensure .next/server exists, then write any missing manifest (always write for start to avoid ENOENT)
if (!fs.existsSync(nextDir)) fs.mkdirSync(nextDir, { recursive: true })
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })
for (const [name, content] of Object.entries(manifests)) {
  const p = path.join(distDir, name)
  if (!fs.existsSync(p)) fs.writeFileSync(p, content, 'utf8')
}

// Verify critical file so we fail fast if something is wrong
const middlewareManifest = path.join(distDir, 'middleware-manifest.json')
if (!fs.existsSync(middlewareManifest)) {
  console.error('ensure-dev-manifests: failed to create middleware-manifest.json')
  process.exit(1)
}
