/**
 * Load `.env.local` into `process.env` (no dotenv dependency).
 * Used by DB scripts so `npm run init-db` works without exporting DATABASE_URL manually.
 *
 * Default: only set keys that are unset/empty (so a real deploy env can win).
 * `preferLocal: true`: keys present in `.env.local` overwrite the shell — avoids a stale
 * exported `DATABASE_URL` masking the file (common cause of “password failed” while the URI in `.env.local` is correct).
 */
import fs from 'fs'
import path from 'path'

export type LoadEnvLocalOptions = {
  preferLocal?: boolean
}

export function loadEnvLocal(options?: LoadEnvLocalOptions): void {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  const preferLocal = options?.preferLocal === true
  for (const line of content.split('\n')) {
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
      val = val.slice(1, -1).replace(/\\n/g, '\n')
    }
    if (preferLocal || process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val
    }
  }
}
