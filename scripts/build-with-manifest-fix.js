#!/usr/bin/env node
/**
 * Build with manifest fix: Next.js sometimes expects .next/server/*.json manifests
 * to exist during "Collecting page data" before it has written them. This script
 * runs next build and keeps those manifest files present whenever .next/server
 * exists so the build can complete.
 *
 * iCloud Drive: If the project lives in ~/Library/Mobile Documents/.../CloudDocs/,
 * Node can hit ETIMEDOUT on readFileSync. Move the project to a local folder
 * (e.g. ~/Projects/00-00) or in Finder: right-click project → "Download Now".
 * Set BUILD_SKIP_ICLOUD_CHECK=1 to skip this check and try anyway.
 */
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const cwd = process.cwd()

// Warn when project is in iCloud Drive (causes ETIMEDOUT on file reads during build)
if (!process.env.BUILD_SKIP_ICLOUD_CHECK) {
  const normalized = cwd.replace(/\\/g, '/')
  if (normalized.includes('CloudDocs') || normalized.includes('iCloud')) {
    console.error('')
    console.error('This project is in iCloud Drive. Builds often fail here with ETIMEDOUT.')
    console.error('')
    console.error('Fix: Move the project to a local folder, then build:')
    console.error('  mv "' + cwd + '" ~/Projects/00-00')
    console.error('  cd ~/Projects/00-00 && npm run build')
    console.error('')
    console.error('Or in Finder: right-click this folder → "Download Now" (or "Keep on This Mac"), then run npm run build again.')
    console.error('To try anyway: BUILD_SKIP_ICLOUD_CHECK=1 npm run build')
    console.error('')
    process.exit(1)
  }
}
const nextDir = path.join(cwd, '.next')
const distDir = path.join(nextDir, 'server')

// Only backfill manifests that don't affect route resolution (pages-manifest is written by Next's server build)
const manifestFiles = [
  'next-font-manifest.json',
  'middleware-manifest.json',
  'server-reference-manifest.json',
]

const middlewareManifestContent = JSON.stringify(
  { sortedMiddleware: [], middleware: {}, functions: {}, matchers: [] },
  null,
  0
)
const serverRefManifestContent = JSON.stringify({ node: {}, edge: {} }, null, 0)

function ensureManifests() {
  // Only write into .next/server when it exists (do not create .next or .next/server)
  if (!fs.existsSync(distDir)) return
  const content = (name) => {
    if (name === 'middleware-manifest.json') return middlewareManifestContent
    if (name === 'server-reference-manifest.json') return serverRefManifestContent
    return '{}'
  }
  for (const name of manifestFiles) {
    const p = path.join(distDir, name)
    try {
      if (!fs.existsSync(p)) fs.writeFileSync(p, content(name), 'utf8')
    } catch (_) {}
  }
  // So Next can copy app _not-found to pages/404.html when it's missing
  const appDir = path.join(distDir, 'app')
  const notFoundPath = path.join(appDir, '_not-found.html')
  try {
    if (fs.existsSync(appDir) && !fs.existsSync(notFoundPath)) {
      fs.writeFileSync(
        notFoundPath,
        '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Not Found</title></head><body><h1>Page not found</h1></body></html>',
        'utf8'
      )
    }
  } catch (_) {}
}

// Clean only when BUILD_CLEAN=1
if (process.env.BUILD_CLEAN === '1') {
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true })
    console.log('Cleaned .next for fresh build.')
  }
}

// Do not pre-create .next — let Next create it so .next/types etc. are correct.
// Watcher below will backfill .next/server and manifests when Next creates them.
// Next may try to `rmdir` `.next/export` during "Collecting page data"; if the folder
// is left non-empty from a crashed/partial build, that throws ENOTEMPTY — remove it first.
const exportDir = path.join(nextDir, 'export')
const serverAppDir = path.join(nextDir, 'server', 'app')
try {
  if (fs.existsSync(exportDir)) {
    fs.rmSync(exportDir, { recursive: true, force: true })
  }
  if (fs.existsSync(serverAppDir)) {
    fs.rmSync(serverAppDir, { recursive: true, force: true })
  }
} catch (err) {
  console.warn('Warning: could not clean stale .next build folders before build:', err?.message ?? err)
}

console.log('Running next build...')

// Keep manifests present when Next (re)creates .next/server (e.g. after wiping .next)
const interval = setInterval(ensureManifests, 100)

// Run next via Node (not shell) so the CLI is never interpreted as shell script.
const nextBin = path.join(cwd, 'node_modules', '.bin', 'next')
const nextBinFallback = path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next')
const nextPath = fs.existsSync(nextBin) ? nextBin : nextBinFallback
if (!fs.existsSync(nextPath)) {
  console.error('next CLI not found. Run: npm install')
  process.exit(1)
}
const child = spawn(process.execPath, [nextPath, 'build', '--webpack'], {
  cwd,
  stdio: 'inherit',
  shell: false,
})

child.on('close', (code) => {
  clearInterval(interval)
  if (code !== 0) {
    console.error('Build failed. Fix errors above and run again.')
    process.exit(code != null ? code : 1)
  }
  const serverDir = path.join(nextDir, 'server')
  const buildIdPath = path.join(nextDir, 'BUILD_ID')
  const hasServer =
    fs.existsSync(serverDir) && fs.readdirSync(serverDir).length > 0
  if (!hasServer) {
    console.error('ERROR: Build completed but .next/server/ is missing or empty.')
    process.exit(1)
  }
  if (!fs.existsSync(buildIdPath)) {
    console.warn(
      'Warning: BUILD_ID not found; .next/server/ exists. Run may have been interrupted.'
    )
  }
  console.log('Build complete. Output in .next')
  process.exit(0)
})

child.on('error', (err) => {
  clearInterval(interval)
  console.error(err)
  process.exit(1)
})
