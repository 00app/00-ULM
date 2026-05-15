/**
 * Load `.env.local` into `process.env` (no dotenv dependency).
 * Used by DB scripts so `npm run init-db` works without exporting DATABASE_URL manually.
 *
 * Default: only set keys that are unset/empty (so a real deploy env can win).
 * `preferLocal: true`: keys present in `.env.local` overwrite the shell — avoids a stale
 * exported `DATABASE_URL` masking the file (common cause of “password failed” while the URI in `.env.local` is correct).
 *
 * Implementation: `load-env-local.cjs` — shared with `next.config.js` for identical behaviour during `next dev`.
 */
export type LoadEnvLocalOptions = {
  preferLocal?: boolean
}

export function loadEnvLocal(options?: LoadEnvLocalOptions): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadEnvLocal: run } = require('./load-env-local.cjs') as {
    loadEnvLocal: (o?: LoadEnvLocalOptions) => void
  }
  run(options)
}
