import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, type AppState, type Job, type JobStatus, type Tier } from '../api'
import { JobRow } from './JobRow'
import { RunPanel } from './RunPanel'

const VIEWS: { status: JobStatus; label: string }[] = [
  { status: 'new', label: 'To review' },
  { status: 'saved', label: 'Saved' },
  { status: 'applied', label: 'Applied' },
  { status: 'hidden', label: 'Hidden' },
]

const TIERS: { tier: Tier; title: string; note: string }[] = [
  { tier: 'apply', title: 'Apply now', note: 'Right role, right level, and you can take it.' },
  { tier: 'strong', title: 'Strong match', note: 'Good fit with a gap or an open question.' },
  { tier: 'maybe', title: 'Worth a look', note: 'Relevant, but something is a stretch.' },
]

const PLACES = [
  { value: -1, label: 'Everywhere' },
  { value: 0, label: 'Target countries' },
  { value: 1, label: 'Remote worldwide' },
  { value: 2, label: 'Home country' },
]

export function Dashboard({ state, onState }: { state: AppState; onState: (s: AppState) => void }) {
  const [view, setView] = useState<JobStatus>('new')
  const [place, setPlace] = useState(-1)
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState('')
  const [runError, setRunError] = useState('')
  const [starting, setStarting] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const loadJobs = useCallback(async () => {
    try {
      setJobs((await api.jobs({ status: view })).jobs)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Loading jobs failed.')
    }
  }, [view])

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
    onState({ ...stateRef.current, run: await api.stopRun() })
  }

  async function changeStatus(job: Job, status: JobStatus) {
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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 pb-8">
        <h1 className="text-title font-semibold sm:text-display">
          {firstName ? `${firstName}'s shortlist` : 'Your shortlist'}
        </h1>
        <p className="pb-1 text-graphite">{state.profile.titles.slice(0, 3).join(', ')}</p>
      </div>

      <RunPanel run={state.run} last={state.last_run} onStart={start} onStop={stop} starting={starting} error={runError} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Job lists" className="flex flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.status}
              role="tab"
              aria-selected={view === v.status}
              onClick={() => setView(v.status)}
              className={`h-9 rounded-md px-3 text-[0.95rem] transition-colors duration-150 ${
                view === v.status ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'
              }`}
            >
              {v.label}
              {state.counts[v.status] ? <span className="ml-1.5 tabular-nums opacity-70">{state.counts[v.status]}</span> : null}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-graphite">
          Show
          <select
            value={place}
            onChange={(e) => setPlace(Number(e.target.value))}
            className="h-9 rounded-md border border-rule bg-sheet px-2 text-[0.95rem] text-ink focus:border-pen focus:outline-none"
          >
            {PLACES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="mt-6 text-sm text-alert">{error}</p>}

      {jobs === null ? (
        <p className="mt-16 text-graphite">Loading jobs</p>
      ) : visible.length === 0 ? (
        <Empty view={view} running={state.run.running} filtered={place !== -1 && (jobs?.length ?? 0) > 0} />
      ) : view === 'new' ? (
        TIERS.map(({ tier, title, note }) => {
          const group = visible.filter((j) => j.tier === tier)
          if (!group.length) return null
          return (
            <section key={tier} className="mt-12" aria-labelledby={`tier-${tier}`}>
              <div className="flex flex-wrap items-baseline gap-x-4 border-b border-ink pb-3">
                <h2 id={`tier-${tier}`} className="text-xl font-semibold">
                  {title} <span className="font-normal text-graphite tabular-nums">{group.length}</span>
                </h2>
                <p className="text-sm text-graphite">{note}</p>
              </div>
              <ul>
                {group.map((j) => (
                  <JobRow key={j.id} job={j} onStatus={(s) => void changeStatus(j, s)} />
                ))}
              </ul>
            </section>
          )
        })
      ) : (
        <ul className="mt-8 border-t border-ink">
          {visible.map((j) => (
            <JobRow key={j.id} job={j} onStatus={(s) => void changeStatus(j, s)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Empty({ view, running, filtered }: { view: JobStatus; running: boolean; filtered: boolean }) {
  let text: string
  if (filtered) text = 'Nothing here for this place. Choose Everywhere to see the rest.'
  else if (view !== 'new') text = { saved: 'Jobs you save appear here.', applied: 'Mark jobs as applied to track them here.', hidden: 'Hidden jobs appear here.', new: '' }[view]
  else if (running) text = 'Jobs appear here as the search reads them.'
  else text = 'Nothing to review. Run a search, or check back after tomorrow’s.'
  return <p className="mt-16 max-w-[48ch] text-[1.05rem] text-graphite">{text}</p>
}
