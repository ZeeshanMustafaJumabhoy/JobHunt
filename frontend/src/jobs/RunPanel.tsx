import { ChevronDown, CircleAlert, History, Radar, Square } from 'lucide-react'
import { useState } from 'react'
import type { RunRecord, RunState } from '../api'
import { Button, IconTile, Spinner } from '../ui/ui'

function when(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `today at ${time}`
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `yesterday at ${time}`
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${time}`
}

export function RunPanel({
  run,
  last,
  onStart,
  onStop,
  starting,
  error,
}: {
  run: RunState
  last: RunRecord | null
  onStart: () => void
  onStop: () => void
  starting: boolean
  error: string
}) {
  const [showLog, setShowLog] = useState(false)

  const progress = !run.running
    ? 0
    : run.phase === 'searching'
      ? (run.sources_done / Math.max(run.sources_total, 1)) * 0.35
      : run.phase === 'filtering'
        ? 0.38
        : 0.4 + (run.scored / Math.max(run.to_score, 1)) * 0.6

  let title: string
  let summary: string
  const failed = !run.running && last?.status === 'failed'
  if (run.running) {
    title = run.message || 'Searching'
    summary =
      run.phase === 'scoring'
        ? `Read ${run.scored} of ${run.to_score} jobs. ${run.matches} worth a look so far.`
        : run.phase === 'searching'
          ? `Checked ${run.sources_done} of ${run.sources_total} sources, ${run.found} matching titles.`
          : 'Removing duplicates and jobs you have already seen.'
  } else if (!last) {
    title = 'Ready to search'
    summary = 'Run your first search to fill your shortlist.'
  } else if (failed) {
    title = 'The last search failed'
    summary = last.error ?? 'Something went wrong.'
  } else if (last.status === 'interrupted') {
    title = 'The last search was interrupted'
    summary = 'It stopped when Shortlist was closed. Search again to pick up.'
  } else {
    title = `Last search ${when(last.started_at)}`
    summary = `${last.stats.found ?? 0} jobs found, ${last.stats.scored ?? 0} read by the AI, ${last.stats.matches ?? 0} worth a look.`
  }

  return (
    <section aria-label="Search" className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-5">
        {run.running ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Spinner className="size-5" />
          </span>
        ) : (
          <IconTile icon={failed ? CircleAlert : last ? History : Radar} tone={failed ? 'danger' : 'brand'} />
        )}
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="truncate font-medium">{title}</p>
          <p className="text-sm text-muted">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          {(run.running || last?.stats.rejected) && (
            <Button variant="ghost" size="sm" onClick={() => setShowLog(!showLog)} aria-expanded={showLog}>
              {showLog ? 'Hide details' : 'Details'}
              <ChevronDown aria-hidden className={`size-4 transition-transform ${showLog ? 'rotate-180' : ''}`} />
            </Button>
          )}
          {run.running ? (
            <Button variant="secondary" icon={Square} onClick={onStop} disabled={run.phase === 'stopped'}>
              Stop
            </Button>
          ) : (
            <Button icon={Radar} onClick={onStart} busy={starting}>
              Search now
            </Button>
          )}
        </div>
      </div>

      {run.running && (
        <div
          className="h-1 bg-subtle"
          role="progressbar"
          aria-label="Search progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-700 ease-out-quart"
            style={{ width: `${Math.max(3, progress * 100)}%` }}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="border-t border-line bg-danger-soft px-5 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {showLog && (
        <div className="grid gap-6 border-t border-line bg-subtle/40 p-5 text-sm sm:grid-cols-2">
          {last?.stats.per_source && !run.running && (
            <div>
              <h3 className="mb-2 font-medium">Matching titles by source</h3>
              <ul className="space-y-1.5 text-muted">
                {Object.entries(last.stats.per_source).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4">
                    <span>{k}</span>
                    <span className="font-medium text-ink tabular-nums">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {last?.stats.rejected && !run.running && Object.keys(last.stats.rejected).length > 0 && (
            <div>
              <h3 className="mb-2 font-medium">Skipped before reading</h3>
              <ul className="space-y-1.5 text-muted">
                {Object.entries(last.stats.rejected).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4">
                    <span>{k}</span>
                    <span className="font-medium text-ink tabular-nums">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {run.log.length > 0 && (
            <div className="sm:col-span-2">
              <h3 className="mb-2 font-medium">Activity</h3>
              <ol className="max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-3 font-mono text-xs leading-relaxed text-muted">
                {run.log.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
