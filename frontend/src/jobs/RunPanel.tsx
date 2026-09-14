import { useState } from 'react'
import type { RunRecord, RunState } from '../api'
import { Button } from '../ui/ui'

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

  let summary: string
  if (run.running) {
    summary =
      run.phase === 'scoring'
        ? `Read ${run.scored} of ${run.to_score} jobs. ${run.matches} worth a look so far.`
        : run.phase === 'searching'
          ? `Checked ${run.sources_done} of ${run.sources_total} sources, ${run.found} matching titles.`
          : 'Removing duplicates and jobs you have already seen.'
  } else if (!last) {
    summary = 'No searches yet.'
  } else if (last.status === 'failed') {
    summary = `The last search failed: ${last.error}`
  } else if (last.status === 'interrupted') {
    summary = 'The last search stopped when Shortlist was closed.'
  } else {
    const m = last.stats.matches ?? 0
    summary = `Last search ${when(last.started_at)}: ${last.stats.found ?? 0} jobs found, ${last.stats.scored ?? 0} read, ${m} worth a look.`
  }

  return (
    <section aria-label="Search" className="border-y border-rule py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0" aria-live="polite">
          {run.running && <p className="text-[0.95rem] font-medium">{run.message}</p>}
          <p className={`text-[0.95rem] ${run.running ? 'text-graphite' : ''}`}>{summary}</p>
        </div>
        <div className="flex items-center gap-4">
          {(run.running || (last && last.stats.rejected)) && (
            <Button variant="plain" onClick={() => setShowLog(!showLog)} aria-expanded={showLog}>
              {showLog ? 'Hide details' : 'Details'}
            </Button>
          )}
          {run.running ? (
            <Button variant="quiet" onClick={onStop} disabled={run.phase === 'stopped'}>
              Stop
            </Button>
          ) : (
            <Button onClick={onStart} busy={starting}>
              Search now
            </Button>
          )}
        </div>
      </div>

      {run.running && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-pen transition-[width] duration-700 ease-settle" style={{ width: `${Math.max(3, progress * 100)}%` }} />
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-alert">{error}</p>}

      {showLog && (
        <div className="mt-5 grid gap-6 text-sm sm:grid-cols-2">
          {last?.stats.per_source && !run.running && (
            <div>
              <h3 className="mb-2 font-medium">Matching titles by source</h3>
              <ul className="space-y-1 text-graphite">
                {Object.entries(last.stats.per_source).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4">
                    <span>{k}</span>
                    <span className="tabular-nums">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {last?.stats.rejected && !run.running && Object.keys(last.stats.rejected).length > 0 && (
            <div>
              <h3 className="mb-2 font-medium">Skipped before reading</h3>
              <ul className="space-y-1 text-graphite">
                {Object.entries(last.stats.rejected).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4">
                    <span>{k}</span>
                    <span className="tabular-nums">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {run.log.length > 0 && (
            <div className="sm:col-span-2">
              <h3 className="mb-2 font-medium">Activity</h3>
              <ol className="max-h-64 overflow-y-auto rounded-md border border-rule bg-sheet p-3 text-[0.8rem] leading-relaxed text-graphite">
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
