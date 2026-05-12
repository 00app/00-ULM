/**
 * v1.8.14 — Production lock: no third-party outbound messaging (Meta Graph / WhatsApp Cloud,
 * SMS bridges, messaging webhooks, etc.). Do not read WHATSAPP_* env for send paths.
 */

export const DISALLOW_OUTBOUND_MESSAGING = true as const

export function assertOutboundMessagingForbidden(caller: string): never {
  throw new Error(`Outbound third-party messaging is forbidden in v1.8.14 (${caller})`)
}
