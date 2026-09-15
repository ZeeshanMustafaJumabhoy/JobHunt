import { CircleAlert, CircleCheck, CircleX, FileSearch, ListChecks, RotateCcw, ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, ApiError, type AppState, type AtsScan, type AtsStatus } from '../api'
import { Button, IconTile, Notice, ScoreRing, Skeleton } from '../ui/ui'

const COOLDOWN_MS = 10 * 60 * 1000

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  return `${Math.floor(hr / 24)} day${Math.floor(hr / 24) === 1 ? '' : 's'} ago`
}

const STATUS_ICON = { good: CircleCheck, warning: CircleAlert, bad: CircleX }
const STATUS_TONE: Record<AtsStatus, 'success' | 'warning' | 'danger'> = { good: 'success', warning: 'warning', bad: 'danger' }

function goToResumeSettings() {
  window.location.hash = '#/settings'
  setTimeout(() => document.getElementById('resume')?.scrollIntoView({ behavior: 'smooth' }), 50)
}

export function AtsPortal({ state }: { state: AppState }) {
  const hasResume = state.profile.has_resume
  // undefined: still loading. null: loaded, never scanned.
  const [scan, setScan] = useState<AtsScan | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!hasResume) return
    api
      .getResumeScan()
      .then((r) => setScan(r.scan))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Loading your last scan failed.'))
  }, [hasResume])

  useEffect(() => {
    if (!scan) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [scan])

  async function scanNow() {
    setBusy(true)
    setError('')
    try {
      setScan((await api.scanResume()).scan)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Scanning failed.')
    } finally {
      setBusy(false)
    }
  }

  const remainingMs = scan ? COOLDOWN_MS - (now - new Date(scan.scanned_at).getTime()) : 0
  const cooling = remainingMs > 0
  const rescanLabel = cooling
    ? `Rescan in ${Math.floor(remainingMs / 60000)}m ${Math.floor((remainingMs % 60000) / 1000)}s`
    : 'Rescan'

  return (
    <div>
      <div>
        <p className="text-sm font-medium text-brand">Resume</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">Resume score</h1>
        <p className="mt-1 text-muted">How your resume reads to an ATS scanner, and to Shortlist's own matching.</p>
      </div>

      {!hasResume ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <FileSearch aria-hidden className="size-7" />
          </span>
          <p className="mt-4 font-semibold tracking-tight">Add your resume first</p>
          <p className="mt-1 max-w-[44ch] text-sm text-muted">Shortlist needs your resume on file before it can score it.</p>
          <Button className="mt-5" onClick={goToResumeSettings}>
            Go to Resume settings
          </Button>
        </div>
      ) : scan === undefined ? (
        <div className="card mt-6 space-y-3 p-6" role="status" aria-label="Loading resume score">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : scan === null ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ScanLine aria-hidden className="size-7" />
          </span>
          <p className="mt-4 font-semibold tracking-tight">Not scanned yet</p>
          <p className="mt-1 max-w-[48ch] text-sm text-muted">
            See how your resume reads to an ATS scanner, and exactly what to fix before you apply.
          </p>
          <Button className="mt-5" onClick={() => void scanNow()} busy={busy}>
            Scan my resume
          </Button>
          {error && (
            <div className="mt-4">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="card flex flex-wrap items-center gap-6 p-6">
            <ScoreRing score={scan.score} size={88} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] leading-relaxed">{scan.summary}</p>
              <p className="mt-1 text-xs text-faint">Scanned {timeAgo(scan.scanned_at)}</p>
            </div>
            <Button variant="secondary" icon={RotateCcw} onClick={() => void scanNow()} busy={busy} disabled={cooling}>
              {rescanLabel}
            </Button>
          </div>
          {cooling && (
            <p className="text-xs text-faint">
              Give any resume edits time to matter — rescanning right after you scan won't show anything new.
            </p>
          )}
          {error && <Notice tone="error">{error}</Notice>}

          <div className="card p-6">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <ListChecks aria-hidden className="size-4 text-brand" />
              ATS checklist
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {scan.checks.map((c) => {
                const Icon = STATUS_ICON[c.status]
                return (
                  <li key={c.category} className="flex items-start gap-3 py-3">
                    <IconTile icon={Icon} tone={STATUS_TONE[c.status]} />
                    <div className="min-w-0">
                      <p className="font-medium">{c.category}</p>
                      <p className="mt-0.5 text-sm text-muted">{c.note}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {scan.suggestions.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-medium">What to change</h2>
              <ol className="mt-4 space-y-3">
                {scan.suggestions.map((s, i) => (
                  <li key={s} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink tabular-nums">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
