/**
 * App-level feature flags — simple, hardcoded toggles for features that are built but
 * paused because they add too much surface for where the app is right now (not an
 * infra/cost kill switch like `isLiveLlmContentEnabled`, just a product "not yet").
 * Nothing behind these flags is deleted — flip back to `true` to re-enable.
 */

/** Zai chat (deep-dive assistant) — /zai route + nav icon. Paused: too much complexity for now. */
export function isZaiChatEnabled(): boolean {
  return false
}

/** Dislike button on Solo Focus / bento cards. Paused alongside Zai chat. */
export function isDislikeEnabled(): boolean {
  return false
}
