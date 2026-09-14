import { motion, useReducedMotion } from 'motion/react'
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'quiet' | 'plain'

export function Button({
  variant = 'primary',
  busy = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md text-[0.95rem] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'
  const styles: Record<ButtonVariant, string> = {
    primary: 'h-11 px-5 bg-pen text-white hover:bg-pen-deep dark:text-paper',
    quiet: 'h-11 px-4 border border-rule bg-sheet text-ink hover:border-graphite',
    plain: 'h-11 px-1 sm:h-9 text-graphite underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-graphite',
  }
  return (
    <button
      type="button"
      className={`${base} ${styles[variant]} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  )
}

/** A labelled text input. An error replaces the hint and is announced with the field. */
export function Field({
  label,
  hint,
  error,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-11 w-full rounded-md border border-rule bg-sheet px-3 text-base text-ink placeholder:text-faint focus:border-pen focus:outline-none aria-invalid:border-alert sm:text-[0.95rem]"
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-alert">
          <AlertIcon />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-graphite">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

const iconProps = {
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
} as const

export function CheckIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function CloseIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function AlertIcon({ className = 'mt-0.5 size-4 shrink-0' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 16h.01" />
    </svg>
  )
}

export function ExternalIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

/** A toggleable choice. Selected chips get the highlighter mark. */
export function Chip({
  selected,
  onToggle,
  children,
  removable = false,
  label,
}: {
  label?: string
  selected: boolean
  onToggle: () => void
  children: ReactNode
  /** A removable tag in a list. Kept neutral: the marker is for choices and matches. */
  removable?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={removable ? undefined : selected}
      aria-label={label}
      onClick={onToggle}
      className={`group inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[0.9rem] sm:min-h-9 sm:px-3.5 transition-colors duration-150 ${
        removable
          ? 'border-rule bg-sheet text-ink hover:border-graphite'
          : selected
          ? 'border-ink bg-marker-soft text-ink'
          : 'border-rule bg-sheet text-graphite hover:border-graphite hover:text-ink'
      }`}
    >
      {!removable && selected && <CheckIcon className="-ml-0.5 size-3.5" />}
      {children}
      {removable && selected && (
        <CloseIcon className="size-3.5 text-faint group-hover:text-ink" />
      )}
    </button>
  )
}

/** Placeholder block shown while content loads. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-rule/70 ${className}`} />
}

/** Text with a highlighter stroke that draws in once, left to right. */
export function Marked({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className="marker"
      initial={reduce ? false : { backgroundSize: '0% 62%' }}
      animate={{ backgroundSize: '100% 62%' }}
      transition={{ duration: 0.45, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.span>
  )
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const color = tone === 'error' ? 'text-alert' : tone === 'ok' ? 'text-ok' : 'text-graphite'
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-1.5 text-sm ${color}`}>
      {tone === 'error' && <AlertIcon />}
      {tone === 'ok' && <CheckIcon className="mt-0.5 size-4 shrink-0" />}
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
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full border transition-colors duration-150 ${
          checked ? 'border-pen bg-pen' : 'border-rule bg-sheet'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4.5 rounded-full transition-transform duration-150 ease-settle ${
            checked ? 'translate-x-[1.1rem] bg-white dark:bg-paper' : 'translate-x-0.5 bg-faint'
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[0.95rem] text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-graphite">{description}</span>}
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
      className="text-pen underline decoration-pen/30 underline-offset-4 hover:decoration-pen"
    >
      {children}
    </a>
  )
}
