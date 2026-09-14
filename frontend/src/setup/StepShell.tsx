import { useState, type FormEvent, type ReactNode } from 'react'
import { Button, Notice } from '../ui/ui'
import { useFlow } from './flow'

/**
 * Frame for one question. `onSubmit` saves the answer and returns normally on
 * success; throwing shows the error under the buttons and keeps the user here.
 */
export function StepShell({
  title,
  lede,
  children,
  onSubmit,
  submitLabel = 'Continue',
  canSubmit = true,
  skipLabel,
  onSkip,
  showBack = true,
}: {
  title: ReactNode
  lede?: ReactNode
  children?: ReactNode
  onSubmit?: () => Promise<void> | void
  submitLabel?: string
  canSubmit?: boolean
  skipLabel?: string
  onSkip?: () => Promise<void> | void
  showBack?: boolean
}) {
  const { mode, next, back } = useFlow()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function attempt(action: () => Promise<void> | void) {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    void attempt(async () => {
      await onSubmit?.()
      if (mode === 'settings') setSaved(true)
      else next()
    })
  }

  const Heading = mode === 'setup' ? 'h1' : 'h2'
  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <Heading
        tabIndex={-1}
        className={
          mode === 'setup'
            ? 'max-w-[22ch] text-title font-semibold text-balance sm:text-display'
            : 'text-xl font-semibold'
        }
      >
        {title}
      </Heading>
      {lede && (
        <div className={`max-w-[60ch] text-graphite ${mode === 'setup' ? 'mt-4 text-[1.05rem] leading-relaxed' : 'mt-2'}`}>
          {lede}
        </div>
      )}
      {children && <div className={mode === 'setup' ? 'mt-9' : 'mt-6'}>{children}</div>}

      <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${mode === 'setup' ? 'mt-10' : 'mt-6'}`}>
        {(onSubmit || mode === 'setup') && (
          <Button type="submit" busy={busy} disabled={!canSubmit}>
            {mode === 'settings' ? 'Save' : submitLabel}
          </Button>
        )}
        {mode === 'setup' && onSkip && skipLabel && (
          <Button variant="plain" disabled={busy} onClick={() => void attempt(onSkip)}>
            {skipLabel}
          </Button>
        )}
        {mode === 'setup' && showBack && (
          <Button variant="plain" onClick={back}>
            Back
          </Button>
        )}
        {saved && !busy && <Notice tone="ok">Saved</Notice>}
      </div>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </form>
  )
}
