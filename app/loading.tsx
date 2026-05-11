/**
 * Segment loading UI — must render a real node (not `null`) so App Router streaming
 * doesn’t occasionally hang on an empty suspense boundary after fast client navigations.
 * Keeps layout transparent (no purple full-screen flash).
 */
export default function Loading() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    />
  )
}
