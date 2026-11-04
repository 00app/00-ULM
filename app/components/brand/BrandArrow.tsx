/** The front door's 16px arrow (docs/BRAND-LANGUAGE.md buttons); `back` points left. */
export function BrandArrow({ back = false }: { back?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={back ? 'zzb-arrow-back' : undefined}>
      <path
        d={back ? 'M13 8H3M7 4L3 8l4 4' : 'M3 8h10M9 4l4 4-4 4'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
