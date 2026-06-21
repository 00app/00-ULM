/**
 * Structured server error capture — Vercel logs + optional Sentry (SENTRY_DSN).
 */

export type ErrorContext = {
  route?: string
  method?: string
  requestId?: string
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

function sentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim())
}

/** Log structured error; forward to Sentry when SENTRY_DSN is set. */
export function captureServerError(error: unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error))
  const payload = {
    level: 'error',
    message: err.message,
    stack: err.stack,
    route: context.route,
    method: context.method,
    requestId: context.requestId,
    tags: context.tags,
    extra: context.extra,
    ts: new Date().toISOString(),
  }

  console.error('[zz-error]', JSON.stringify(payload))

  if (!sentryConfigured()) return

  const dsn = process.env.SENTRY_DSN!.trim()
  try {
    const u = new URL(dsn)
    const projectId = u.pathname.replace(/^\//, '')
    const host = u.host
    const pubKey = u.username
    const ingest = `https://${host}/api/${projectId}/store/`

    void fetch(ingest, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${pubKey}, sentry_client=zz-ulm/1.0`,
      },
      body: JSON.stringify({
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: new Date().toISOString(),
        platform: 'node',
        level: 'error',
        message: { formatted: err.message },
        exception: {
          values: [{ type: err.name, value: err.message, stacktrace: { frames: [] } }],
        },
        tags: context.tags,
        extra: context.extra,
        request: context.route ? { url: context.route, method: context.method } : undefined,
      }),
      cache: 'no-store',
    }).catch(() => {
      /* never block request path */
    })
  } catch {
    /* invalid DSN — logs only */
  }
}
