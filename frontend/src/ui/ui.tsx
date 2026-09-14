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
    plain: 'h-9 px-1 text-graphite underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-graphite',
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

export function Field({
  label,
  hint,
  error,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-11 w-full rounded-md border border-rule bg-sheet px-3 text-[0.95rem] text-ink placeholder:text-faint focus:border-pen focus:outline-none aria-invalid:border-alert"
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-graphite">
          {hint}
        </p>
      )}
    </div>
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
      className={`group inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[0.9rem] transition-colors duration-150 ${
        removable
          ? 'border-rule bg-sheet text-ink hover:border-graphite'
          : selected
          ? 'border-ink bg-marker-soft text-ink'
          : 'border-rule bg-sheet text-graphite hover:border-graphite hover:text-ink'
      }`}
    >
      {children}
      {removable && selected && (
        <span aria-hidden className="text-faint group-hover:text-ink">
          ×
        </span>
      )}
    </button>
  )
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
    <p role={tone === 'error' ? 'alert' : 'status'} className={`text-sm ${color}`}>
      {children}
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
