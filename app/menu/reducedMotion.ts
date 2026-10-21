/** True when the visitor asked their device for less motion: scroll instantly, skip the nudges. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
