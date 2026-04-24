import IntroScreen from '@/app/components/IntroScreen'

/** Server boundary: client IntroScreen only — avoids nested client + Suspense RSC flight issues in dev (HMR). */
export default function HomePage() {
  return <IntroScreen />
}
