/** Dispatched when the user closes Zai — Zone refetches scrape-sync / hero totals. */
export const ZAI_AUDIT_COMPLETE_EVENT = 'zz-zai-audit-complete'

export function dispatchZaiAuditComplete(detail?: { totalMoney?: number; totalCarbon?: number }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ZAI_AUDIT_COMPLETE_EVENT, { detail }))
}
