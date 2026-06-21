export async function register() {
  /* optional server bootstrap hooks */
}

type RequestErrorContext = {
  routerKind?: string
  routePath?: string
  routeType?: string
}

/** Next.js instrumentation hook — structured logs + optional Sentry. */
export async function onRequestError(
  error: Error,
  request: { path: string; method: string; headers: { [key: string]: string | string[] } },
  context: RequestErrorContext
): Promise<void> {
  const { captureServerError } = await import('@/lib/observability/captureError')
  captureServerError(error, {
    route: request.path,
    method: request.method,
    tags: {
      routerKind: context.routerKind ?? 'unknown',
      routePath: context.routePath ?? 'unknown',
    },
  })
}
