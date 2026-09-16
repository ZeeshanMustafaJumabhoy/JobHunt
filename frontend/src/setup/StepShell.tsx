import { ArrowLeft, Check } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button, Notice } from '../ui/ui'
import { useFlow } from './flow'
import { isPreviewMode } from '../preview'
import { PreviewNotice } from './PreviewNotice'

/**
 * Frame for one question. `onSubmit` saves the answer and returns normally on
 * success; throwing shows the error under the buttons and keeps the user here.
 */
export function StepShell({
  title,
  lede,
  eyebrow,
  children,
  onSubmit,
  submitLabel = 'Continue',
  canSubmit = true,
  skipLabel,
  onSkip,
  showBack = true,
  heroLayout = false,
  alwaysSubmit = false,
}: {
  /** Centered, larger treatment for the welcome screen. */
  heroLayout?: boolean
  title: ReactNode
  lede?: ReactNode
  eyebrow?: ReactNode
  children?: ReactNode
  onSubmit?: () => Promise<void> | void
  submitLabel?: string
  canSubmit?: boolean
  skipLabel?: string
  onSkip?: () => Promise<void> | void
  showBack?: boolean
  /** Run onSubmit even in preview mode. For the one step (Review) whose
   * onSubmit is itself preview-aware, unlike every other step's real save. */
  alwaysSubmit?: boolean
}) {
  const { mode, next, back } = useFlow()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const preview = isPreviewMode()

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
    if (!(canSubmit || preview) || busy) return
    void attempt(async () => {
      // Preview mode is a look-around, not a real answer: skip the save so an
      // empty or invalid field can never block moving to the next step.
      if (!preview || alwaysSubmit) await onSubmit?.()
      if (mode === 'settings') setSaved(true)
      else next()
    })
  }

  async function goBack() {
    if (busy) return
    // Save what's on this step before leaving it — otherwise picking
    // something here and then going Back loses it, since only "Continue"
    // used to save at all. Best-effort: an invalid or empty step (nothing
    // picked yet) shouldn't block leaving, so a failed save is swallowed.
    if (onSubmit && (!preview || alwaysSubmit)) {
      setBusy(true)
      try {
        await onSubmit()
      } catch {
        // Nothing to save, or saving failed — either way, still go back.
      } finally {
        setBusy(false)
      }
    }
    back()
  }

  const setup = mode === 'setup'
  if (heroLayout) {
    return (
      <form onSubmit={submit} noValidate className="flex flex-col items-center">
        <h1 tabIndex={-1} className="mt-6 max-w-[18ch] text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-[3.5rem]">
          {title}
        </h1>
        {lede && <div className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">{lede}</div>}
        {preview && (
          <div className="mt-6 w-full max-w-[56ch]">
            <PreviewNotice />
          </div>
        )}
        <Button type="submit" busy={busy} className="mt-8 h-12 px-6 text-base">
          {submitLabel}
        </Button>
      </form>
    )
  }
  const Heading = setup ? 'h1' : 'h2'
  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      {eyebrow && setup && <div className="mb-3">{eyebrow}</div>}
      <Heading
        tabIndex={-1}
        className={
          setup
            ? 'max-w-[24ch] text-[1.75rem] leading-tight font-semibold tracking-tight text-balance sm:text-[2.125rem]'
            : 'text-lg font-semibold tracking-tight'
        }
      >
        {title}
      </Heading>
      {lede && <div className={`max-w-[62ch] text-muted ${setup ? 'mt-3 text-base leading-relaxed' : 'mt-1 text-sm'}`}>{lede}</div>}
      {preview && (
        <div className={setup ? 'mt-8 max-w-2xl' : 'mt-6 max-w-2xl'}>
          <PreviewNotice />
        </div>
      )}
      {children && <div className={setup ? (preview ? 'mt-2' : 'mt-8') : preview ? 'mt-2' : 'mt-6'}>{children}</div>}

      <div
        className={`flex flex-wrap items-center gap-3 ${
          setup ? 'mt-10 border-t border-line pt-6' : 'mt-6'
        }`}
      >
        {setup && showBack && (
          <Button variant="ghost" icon={ArrowLeft} busy={busy} onClick={() => void goBack()}>
            Back
          </Button>
        )}
        <div className={`flex flex-wrap items-center gap-3 ${setup ? 'ml-auto' : ''}`}>
          {setup && onSkip && skipLabel && (
            <Button variant="ghost" disabled={busy} onClick={() => void attempt(onSkip)}>
              {skipLabel}
            </Button>
          )}
          {(onSubmit || setup) && (
            <Button type="submit" busy={busy} disabled={!(canSubmit || preview)}>
              {setup ? submitLabel : 'Save'}
            </Button>
          )}
          {saved && !busy && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <Check aria-hidden className="size-4" strokeWidth={2.5} />
              Saved
            </span>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </form>
  )
}
