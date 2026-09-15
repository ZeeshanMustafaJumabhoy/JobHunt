import { Check, CircleAlert, CircleCheck, LoaderCircle, X, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'md' | 'sm'

export function Button({
  variant = 'primary',
  size = 'md',
  busy = false,
  icon: Icon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  busy?: boolean
  icon?: LucideIcon
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'
  const sizes: Record<ButtonSize, string> = {
    md: 'h-11 px-4.5 text-[0.9375rem]',
    sm: 'h-11 px-3.5 text-sm sm:h-9',
  }
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand text-white shadow-brand hover:bg-brand-hover dark:text-canvas',
    secondary: 'border border-line bg-surface text-ink shadow-card hover:border-line-strong hover:bg-subtle',
    ghost: 'text-muted hover:bg-subtle hover:text-ink',
    danger: 'border border-danger/30 bg-danger-soft text-danger hover:border-danger/60',
  }
  return (
    <button
      type="button"
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner /> : Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
      {children}
    </button>
  )
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <LoaderCircle aria-hidden className={`animate-spin ${className}`} />
}

/** A labelled text input. An error replaces the hint and is announced with the field. */
export function Field({
  label,
  hint,
  error,
  icon: Icon,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string; icon?: LucideIcon }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-11 w-full rounded-[10px] border border-line bg-surface text-base text-ink shadow-card transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none aria-invalid:border-danger aria-invalid:focus:ring-danger/15 sm:text-[0.9375rem] ${
            Icon ? 'pr-3.5 pl-10' : 'px-3.5'
          }`}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export const selectClass =
  'h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-base text-ink shadow-card transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none sm:text-[0.9375rem]'

/** A toggleable pill. Selected pills carry a check so selection isn't color alone. */
export function Chip({
  selected,
  onToggle,
  children,
  removable = false,
  label,
}: {
  selected: boolean
  onToggle: () => void
  children: ReactNode
  removable?: boolean
  label?: string
}) {
  const tone = removable
    ? 'border-line bg-subtle text-ink hover:border-line-strong'
    : selected
      ? 'border-brand/40 bg-brand-soft text-brand-ink'
      : 'border-line bg-surface text-muted shadow-card hover:border-line-strong hover:text-ink'
  return (
    <button
      type="button"
      aria-pressed={removable ? undefined : selected}
      aria-label={label}
      onClick={onToggle}
      className={`group inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors duration-150 sm:min-h-9 sm:px-3.5 ${tone}`}
    >
      {!removable && selected && <Check aria-hidden className="-ml-0.5 size-3.5" strokeWidth={2.5} />}
      {children}
      {removable && <X aria-hidden className="-mr-1 size-3.5 text-faint group-hover:text-ink" />}
    </button>
  )
}

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

export function Badge({ tone = 'neutral', icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    brand: 'bg-brand-soft text-brand-ink',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-subtle text-muted',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  )
}

/** A skill pill that pops in with a short stagger, used where the AI has just found something. */
export function Marked({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-sm font-medium text-success"
      initial={reduce ? false : { opacity: 0, scale: 0.85, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26, delay }}
    >
      <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
      {children}
    </motion.span>
  )
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'bg-danger-soft text-danger',
    ok: 'bg-success-soft text-success',
    info: 'bg-subtle text-muted',
  }[tone]
  const Icon = tone === 'error' ? CircleAlert : tone === 'ok' ? CircleCheck : null
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`inline-flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${styles}`}>
      {Icon && <Icon aria-hidden className="mt-px size-4 shrink-0" />}
      <span>{children}</span>
    </p>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-brand' : 'bg-line-strong'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-raised transition-transform duration-200 ease-out-quart ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
      <label htmlFor={id}>
        <span className="block text-[0.9375rem] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </label>
    </div>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-brand underline decoration-brand/30 underline-offset-4 transition-colors hover:decoration-brand"
    >
      {children}
    </a>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-md bg-subtle ${className}`} />
}

/** Rounded icon tile used on stat cards and feature lists. */
export function IconTile({ icon: Icon, tone = 'brand' }: { icon: LucideIcon; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-subtle text-muted',
  }
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
      <Icon aria-hidden className="size-5" />
    </span>
  )
}

/** Circular score meter, colored by how strong the match is. */
export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const reduce = useReducedMotion()
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = score >= 80 ? 'var(--color-success)' : score >= 65 ? 'var(--color-brand)' : 'var(--color-warning)'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Match score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-subtle)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-base font-semibold tabular-nums">{score}</span>
    </div>
  )
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight text-ink">
      <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-brand to-brand-2 text-white shadow-brand">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
          <path d="M5 7h14M5 12h14M5 17h8" />
        </svg>
      </span>
      Shortlist
    </span>
  )
}
