import IntroScreen from '@/app/components/IntroScreen'

/**
 * Server boundary: client IntroScreen only — avoids nested client + Suspense RSC flight issues in dev (HMR).
 * Same intro flow as `/intro` — v6 kinetic shimmer wired inside `IntroScreen`.
 */
export default function HomePage() {
  return <IntroScreen />
}
