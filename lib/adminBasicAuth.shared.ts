/**
 * Admin auth header helper — uses environment variables only (never hardcoded secrets).
 * Server routes should prefer `ADMIN_BASIC_AUTH` (see `lib/adminBasicAuth.ts`).
 */
export const getAdminAuthHeader = () => {
  return process.env.ADMIN_AUTH_HEADER?.trim() || ''
}
