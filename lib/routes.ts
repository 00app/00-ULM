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
} as const

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES] | string
