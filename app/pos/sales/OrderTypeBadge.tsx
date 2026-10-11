import { ORDER_TYPE_LABELS, type OrderType } from '@/lib/sales/payments'
import { BagIcon, CupIcon } from './icons'

/** Dine in (outlined) or Take out (filled, as the kitchen ticket's black band) on a Sales card. */
export default function OrderTypeBadge({ type }: { type: OrderType }) {
  const takeOut = type === 'take-out'
  const Icon = takeOut ? BagIcon : CupIcon
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold leading-none ${
        takeOut ? 'bg-foreground text-cream' : 'border border-foreground/20 bg-white text-foreground'
      }`}
    >
      <Icon width={12} height={12} />
      {ORDER_TYPE_LABELS[type]}
    </span>
  )
}
