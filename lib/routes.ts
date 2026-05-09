/**
 * Single source for app route paths. Use these everywhere so links stay consistent.
 */
export const ROUTES = {
  HOME: '/',
  INTRO: '/intro',
  PROFILE: '/profile',
  PROFILE_SUMMARY: '/profile/summary',
  ZONE: '/zone',
  ZAI: '/zai',
  LIKES: '/likes',
  SETTINGS: '/settings',
  /** Ops: dependency heartbeat (session or gateway bearer). */
  ADMIN_PULSE: '/admin/pulse',
} as const

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES] | string
