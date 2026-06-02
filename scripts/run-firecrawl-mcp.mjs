#!/usr/bin/env node
/**
 * Cursor MCP bridge — loads Firecrawl key from .env.local (same order as lib/sentinel/api-config.ts)
 * and starts the official firecrawl-mcp server. Never commit API keys into .cursor/mcp.json.
 */
'use strict'

const { spawn } = require('child_process')
const path = require('path')
const { loadEnvLocal } = require('./load-env-local.cjs')

loadEnvLocal({ preferLocal: true })

const key =
  process.env.FIRE_CRAWL_KEY_3?.trim() ||
  process.env.FIRE_CRAWL_KEY_2?.trim() ||
  process.env.FIRECRAWL_API_KEY?.trim() ||
  ''

if (!key) {
  console.error(
    '[firecrawl-mcp] Missing Firecrawl key — set FIRE_CRAWL_KEY_3 in .env.local (see .env.example).'
  )
  process.exit(1)
}

process.env.FIRECRAWL_API_KEY = key

const child = spawn('npx', ['-y', 'firecrawl-mcp'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

child.on('error', (err) => {
  console.error('[firecrawl-mcp] failed to start:', err.message)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 1)
})
