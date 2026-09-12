import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AlertIcon, XIcon } from './icons'

// Shared building blocks for the sales screen: sized so every control is an
// easy tap target on the café's tablet, and toned from the brand palette
// (deep green for primary, emerald for "done", red only for destructive).

export type ActionTone = 'primary' | 'success' | 'neutral' | 'danger' | 'destructive' | 'ghost' | 'info'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ActionTone
  icon?: ReactNode
  /** Icon after the label, e.g. a forward chevron. Hidden while busy or failed, like `icon`. */
  trailingIcon?: ReactNode
  /** Shows a spinner and disables the button while an async action runs. */
  busy?: boolean
  /** Red styling with a warning icon after a failed attempt — the button stays tappable to retry. */
  failed?: boolean
}

const TONE_CLASSES: Record<ActionTone, string> = {
  primary: 'bg-foreground text-cream hover:bg-foreground/90',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  neutral: 'bg-white border border-foreground/20 text-foreground/75 hover:border-foreground/45 hover:text-foreground',
  info: 'bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 hover:border-sky-300',
  danger: 'text-red-500 border border-transparent hover:bg-red-50 hover:border-red-200',
  /** Filled red — only for the final "yes, delete" tap inside an inline confirmation. */
  destructive: 'bg-red-500 text-white hover:bg-red-600',
  ghost: 'text-foreground/55 hover:text-foreground hover:bg-foreground/5',
}

const FAILED_CLASSES = 'bg-red-50 border border-red-300 text-red-600 hover:bg-red-100'

export function ActionButton({
  tone = 'neutral',
  icon,
  trailingIcon,
  busy = false,
  failed = false,
  className = '',
  children,
  disabled,
  ...rest
}: ActionButtonProps) {
  const settled = !busy && !failed
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        failed ? FAILED_CLASSES : TONE_CLASSES[tone]
      } ${className}`}
      {...rest}
    >
      {busy ? <Spinner /> : failed ? <AlertIcon /> : icon}
      {children}
      {settled && trailingIcon}
    </button>
  )
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
}

interface RemoveButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string
}

/** Round icon-only remove control for line items — sized as a comfortable tablet tap target. */
export function RemoveButton({ className = '', ...rest }: RemoveButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 ${className}`}
      {...rest}
    >
      <XIcon />
    </button>
  )
}

interface InlineConfirmProps {
  message: ReactNode
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}

/** Replaces a row's controls with a question and two clear choices — no modal, no accidental taps. */
export function InlineConfirm({ message, confirmLabel, onCancel, onConfirm }: InlineConfirmProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-foreground/75">{message}</span>
      <div className="flex items-center gap-2">
        <ActionButton tone="ghost" onClick={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton tone="destructive" onClick={onConfirm}>
          {confirmLabel}
        </ActionButton>
      </div>
    </div>
  )
}

export type BadgeTone = 'name' | 'pending' | 'success' | 'neutral'

const BADGE_CLASSES: Record<BadgeTone, string> = {
  name: 'bg-[#d4ede1] text-[#1f5c3c]',
  pending: 'bg-amber-100 text-amber-800',
  success: 'bg-emerald-100 text-emerald-700',
  neutral: 'bg-foreground/10 text-foreground/60',
}

interface BadgeProps {
  tone: BadgeTone
  children: ReactNode
  className?: string
  title?: string
}

export function Badge({ tone, children, className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-semibold leading-none ${BADGE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Skeleton({ rows, height = 'h-28' }: { rows: number; height?: string }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`skeleton-${i}`} className={`${height} animate-pulse rounded-lg border border-border bg-white/50`} />
      ))}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-foreground/15 px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground/60">{title}</p>
      {hint && <p className="mt-1 text-xs text-foreground/40">{hint}</p>}
    </div>
  )
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <AlertIcon />
        {message}
      </span>
      <button type="button" onClick={onDismiss} className="text-[11px] font-bold uppercase tracking-widest text-red-600 hover:text-red-800">
        Dismiss
      </button>
    </div>
  )
}
