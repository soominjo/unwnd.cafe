export function variantClass(variant: string | null): string {
  if (variant === 'hot') return 'text-red-500'
  if (variant === 'ice') return 'text-sky-500'
  return 'text-foreground/30'
}
