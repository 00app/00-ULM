import fs from 'fs'
import path from 'path'
import { loadEnvLocal } from './load-env-local'
import { sanitizeNeonConnectionString } from '../lib/db'

const ENV_CANDIDATES = [
  '.env.local',
  '.vercel/.env.production.local',
  '.env.production.local',
  '.env.vercel.pull',
]

export function loadEnvFile(relPath: string): boolean {
  const envPath = path.join(process.cwd(), relPath)
  if (!fs.existsSync(envPath)) return false
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (val) process.env[key] = val
  }
  return true
}

export function resolveDatabaseUrl(): string {
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL']) {
    const url = sanitizeNeonConnectionString(process.env[key]?.trim() ?? '')
    if (url) return url
  }
  return ''
}

export function loadDatabaseEnv(options?: { envFile?: string }) {
  if (options?.envFile) {
    if (!loadEnvFile(options.envFile)) {
      throw new Error(`Env file not found: ${options.envFile}`)
    }
  } else {
    loadEnvLocal({ preferLocal: true })
  }
  if (resolveDatabaseUrl()) return
  for (const candidate of ENV_CANDIDATES) {
    if (options?.envFile && path.normalize(candidate) === path.normalize(options.envFile)) continue
    loadEnvFile(candidate)
    if (resolveDatabaseUrl()) return
  }
}

export function requireDatabaseUrl(): string {
  const url = resolveDatabaseUrl()
  if (!url) {
    throw new Error('DATABASE_URL missing — run: npm run env:sync (then paste DATABASE_URL from Neon if still empty)')
  }
  return url
}
