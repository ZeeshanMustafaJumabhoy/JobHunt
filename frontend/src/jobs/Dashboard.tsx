import { Bookmark, CircleCheck, Inbox, Sparkles, type LucideIcon } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, type AppState, type Job, type JobStatus, type Tier } from '../api'
import { isPreviewMode } from '../setup/preview'
import { Button, IconTile, Skeleton, selectClass } from '../ui/ui'
import { JobRow } from './JobRow'
import { PREVIEW_JOBS, PREVIEW_LAST_RUN, PREVIEW_RUN_STATE, PREVIEW_RUNNING_STATE } from './previewJobs'
import { RunPanel } from './RunPanel'

const VIEWS: { status: JobStatus; label: string }[] = [
  { status: 'new', label: 'To review' },
  { status: 'saved', label: 'Saved' },
  { status: 'applied', label: 'Applied' },
  { status: 'hidden', label: 'Hidden' },
]

const TIERS: { tier: Tier; title: string; note: string; dot: string }[] = [
  { tier: 'apply', title: 'Apply now', note: 'Right role, right level, and you can take it.', dot: 'bg-success' },
  { tier: 'strong', title: 'Strong match', note: 'Good fit with a gap or an open question.', dot: 'bg-brand' },
  { tier: 'maybe', title: 'Worth a look', note: 'Relevant, but something is a stretch.', dot: 'bg-warning' },
]

const PLACES = [
  { value: -1, label: 'Everywhere' },
  { value: 0, label: 'Target countries' },
  { value: 1, label: 'Remote worldwide' },
  { value: 2, label: 'Home country' },
]

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Stat({ icon, tone, label, value, hint }: { icon: LucideIcon; tone: 'brand' | 'success' | 'warning' | 'neutral'; label: string; value: ReactNode; hint: string }) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-0.5 truncate text-xs text-faint">{hint}</p>
      </div>
    </div>
  )
}

export function Dashboard({ state, onState }: { state: AppState; onState: (s: AppState) => void }) {
  const preview = isPreviewMode()
  const [view, setView] = useState<JobStatus>('new')
  const [place, setPlace] = useState(-1)
  const [jobs, setJobs] = useState<Job[] | null>(null)
  // A local, in-memory copy so preview mode can save/apply/hide without a
  // real backend — never touched when not in preview mode.
  const [previewAll, setPreviewAll] = useState<Job[]>(() => PREVIEW_JOBS.map((j) => ({ ...j })))
  const [error, setError] = useState('')
  const [runError, setRunError] = useState('')
  const [starting, setStarting] = useState(false)
  // A fake run for preview mode: no real search, just something to watch.
  const [previewSearching, setPreviewSearching] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const minScore = state.profile.min_match_score
  const loadJobs = useCallback(async () => {
    if (preview) {
      setJobs(previewAll.filter((j) => j.status === view))
      setError('')
      return
    }
    try {
      setJobs((await api.jobs({ status: view, minScore })).jobs)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Loading jobs failed.')
    }
  }, [view, minScore, preview, previewAll])

  useEffect(() => {
    setJobs(null)
    void loadJobs()
  }, [loadJobs])

  // While a search runs, poll its progress and refresh the list as jobs are read.
  const running = state.run.running
  useEffect(() => {
    if (!running) return
    let ticks = 0
    const timer = setInterval(async () => {
      ticks++
      try {
        const run = await api.runStatus()
        if (!run.running) {
          const fresh = await api.state()
          onState(fresh)
          void loadJobs()
        } else {
          onState({ ...stateRef.current, run })
          if (ticks % 4 === 0) void loadJobs()
        }
      } catch {
        // A missed poll is fine; the next one catches up.
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [running, loadJobs, onState])

  async function start() {
    if (preview) {
      setRunError('')
      setPreviewSearching(true)
      setTimeout(() => setPreviewSearching(false), 4000)
      return
    }
    setStarting(true)
    setRunError('')
    try {
      const run = await api.startRun()
      onState({ ...stateRef.current, run })
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : 'Starting the search failed.')
    } finally {
      setStarting(false)
    }
  }

  async function stop() {
    if (preview) {
      setPreviewSearching(false)
      return
    }
    onState({ ...stateRef.current, run: await api.stopRun() })
  }

  async function changeStatus(job: Job, status: JobStatus) {
    if (preview) {
      setPreviewAll((cur) => cur.map((j) => (j.id === job.id ? { ...j, status } : j)))
      return
    }
    const before = jobs
    setJobs((cur) => cur?.filter((j) => j.id !== job.id) ?? null)
    try {
      await api.setJobStatus(job.id, status)
    } catch (err) {
      setJobs(before)
      setError(err instanceof ApiError ? err.message : 'Updating the job failed.')
    }
  }

  const visible = (jobs ?? []).filter((j) => place === -1 || j.bucket === place)
  const firstName = state.profile.name.split(' ')[0]
  const counts = preview
    ? previewAll.reduce<Record<string, number>>((acc, j) => ({ ...acc, [j.status]: (acc[j.status] ?? 0) + 1 }), {})
    : state.counts
  const run = preview ? (previewSearching ? PREVIEW_RUNNING_STATE : PREVIEW_RUN_STATE) : state.run
  const lastRun = preview ? PREVIEW_LAST_RUN : state.last_run
  const applyNow = view === 'new' && jobs ? jobs.filter((j) => j.tier === 'apply').length : null

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div>
          <p className="text-sm font-medium text-brand">{greeting()}</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
            {firstName ? `${firstName}'s shortlist` : 'Your shortlist'}
          </h1>
          <p className="mt-1 text-muted">{state.profile.titles.slice(0, 3).join(', ')}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Inbox} tone="brand" label="To review" value={counts.new ?? 0} hint="New matches waiting" />
        <Stat icon={Sparkles} tone="success" label="Apply now" value={applyNow ?? '–'} hint="Your strongest matches" />
        <Stat icon={Bookmark} tone="warning" label="Saved" value={counts.saved ?? 0} hint="Kept for later" />
        <Stat icon={CircleCheck} tone="neutral" label="Applied" value={counts.applied ?? 0} hint="Applications sent" />
      </div>

      <div className="mt-3">
        <RunPanel run={run} last={lastRun} onStart={start} onStop={stop} starting={starting} error={runError} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Job lists" className="inline-flex flex-wrap rounded-xl bg-subtle p-1">
          {VIEWS.map((v) => (
            <button
              key={v.status}
              role="tab"
              aria-selected={view === v.status}
              onClick={() => setView(v.status)}
              className={`inline-flex h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 sm:h-9 ${
                view === v.status ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
              }`}
            >
              {v.label}
              {counts[v.status] ? (
                <span
                  className={`rounded-full px-1.5 py-px text-xs tabular-nums ${
                    view === v.status ? 'bg-brand-soft text-brand-ink' : 'bg-line/70 text-muted'
                  }`}
                >
                  {counts[v.status]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Show
          <select value={place} onChange={(e) => setPlace(Number(e.target.value))} className={`${selectClass} w-auto sm:h-9`}>
            {PLACES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {jobs === null ? (
        <div className="mt-6 space-y-3" role="status" aria-label="Loading jobs">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card flex gap-5 p-6">
              <Skeleton className="size-14 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-2/3 max-w-sm" />
                <Skeleton className="h-4 w-1/2 max-w-xs" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-28 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Empty view={view} running={run.running} filtered={place !== -1 && (jobs?.length ?? 0) > 0} onShowAll={() => setPlace(-1)} />
      ) : view === 'new' ? (
        TIERS.map(({ tier, title, note, dot }) => {
          const group = visible.filter((j) => j.tier === tier)
          if (!group.length) return null
          return (
            <section key={tier} className="mt-8" aria-labelledby={`tier-${tier}`}>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span aria-hidden className={`size-2 rounded-full ${dot}`} />
                <h2 id={`tier-${tier}`} className="text-base font-semibold tracking-tight">
                  {title} <span className="ml-1 rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-muted tabular-nums">{group.length}</span>
                </h2>
                <p className="text-sm text-muted">{note}</p>
              </div>
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {group.map((j) => (
                    <JobRow key={j.id} job={j} onStatus={(s) => void changeStatus(j, s)} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          )
        })
      ) : (
        <ul className="mt-6 space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((j) => (
              <JobRow key={j.id} job={j} onStatus={(s) => void changeStatus(j, s)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}

function Empty({
  view,
  running,
  filtered,
  onShowAll,
}: {
  view: JobStatus
  running: boolean
  filtered: boolean
  onShowAll: () => void
}) {
  let title: string
  let text: string
  let action: ReactNode = null
  if (filtered) {
    title = 'Nothing here for this place'
    text = 'Other places have matches.'
    action = (
      <Button variant="secondary" onClick={onShowAll}>
        Show everywhere
      </Button>
    )
  } else if (view !== 'new') {
    title = { saved: 'No saved jobs', applied: 'No applications yet', hidden: 'No hidden jobs', new: '' }[view]
    text = {
      saved: 'Jobs you save appear here.',
      applied: 'Mark jobs as applied to keep track of them here.',
      hidden: 'Jobs you hide appear here.',
      new: '',
    }[view]
  } else if (running) {
    title = 'Searching'
    text = 'Jobs appear here as the search reads them.'
  } else {
    title = 'Nothing new to review'
    text = 'Use Search now above, or check back after the next daily search.'
  }
  return (
    <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Inbox aria-hidden className="size-7" />
      </span>
      <p className="mt-4 font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-[44ch] text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
