/**
 * Intercepted from /zone — the already-mounted /zone page (this route's `children` sibling
 * slot) is what actually renders the expanded card, reacting to this same URL via the
 * pathname <-> expandedCardId sync effect in app/zone/page.tsx. This slot's only job is to
 * make Next.js treat /zone -> /zone/card/[journeyKey] as a soft navigation (so /zone stays
 * mounted, back button works, and the tab gets a real URL) rather than a full page swap —
 * it renders nothing of its own, exactly preserving today's ExpandedCardShell output.
 */
export default function InterceptedCardModal() {
  return null
}
