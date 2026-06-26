import type { NextRequest } from 'next/server'
import {
  attachSessionCookieToResponse,
  resolveAuthenticatedUser,
  type ResolvedAuthenticatedUser,
} from '@/lib/auth/resolveAuthenticatedUser'

/** @deprecated Import from `@/lib/auth/resolveAuthenticatedUser`. */
export type ResolvedAnswersUser = ResolvedAuthenticatedUser

/** @deprecated Import `resolveAuthenticatedUser` from `@/lib/auth/resolveAuthenticatedUser`. */
export const resolveAnswersUser = resolveAuthenticatedUser

export { attachSessionCookieToResponse }
