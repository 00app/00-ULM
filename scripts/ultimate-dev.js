#!/usr/bin/env node
/**
 * Ultimate dev: ensure manifests, start Next dev server, then open browser.
 * Opens system default browser (e.g. Cursor Simple Browser or Chrome).
 */
const { spawn, execSync } = require('child_process')
const path = require('path')
const http = require('http')

const PORT = Number(process.env.PORT) || 3000
const ROOT = process.cwd()

// Ensure dev manifests (same as ensure-dev-manifests.js)
try {
  execSync('node scripts/ensure-dev-manifests.js', { cwd: ROOT, stdio: 'pipe' })
} catch (_) {}

function waitForServer(maxAttempts = 30) {
  return new Promise((resolve) => {
    let attempts = 0
    const tryConnect = () => {
      http.get(`http://127.0.0.1:${PORT}`, (res) => { resolve(true) }).on('error', () => {
        attempts++
        if (attempts >= maxAttempts) return resolve(false)
        setTimeout(tryConnect, 500)
      })
    }
    tryConnect()
  })
}

function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  require('child_process').spawn(start, [url], { stdio: 'ignore', detached: true }).unref()
}

const child = spawn('npx', ['next', 'dev', '--webpack', '-p', String(PORT)], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    WATCHPACK_POLLING: '1',
    CHOKIDAR_USEPOLLING: 'true',
  },
})

child.on('error', (err) => {
  console.error(err)
  process.exit(1)
})

// After server is ready, open browser once
waitForServer().then((ok) => {
  if (ok) {
    const url = `http://localhost:${PORT}`
    console.log(`\n✓ Opening ${url}\n`)
    openBrowser(url)
  }
})

child.on('close', (code) => process.exit(code ?? 0))
