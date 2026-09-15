import { FileSearch, LayoutList, Settings as SettingsIcon, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type AppState, type Reference } from './api'
import { Dashboard } from './jobs/Dashboard'
import { AtsPortal } from './resume/AtsPortal'
import { Settings } from './settings/Settings'
import { Setup } from './setup/Setup'
import { Button, Logo, Skeleton, ThemeToggle } from './ui/ui'

type Page = 'jobs' | 'resume' | 'settings'

function pageFromHash(): Page {
  if (window.location.hash.startsWith('#/settings')) return 'settings'
  if (window.location.hash.startsWith('#/resume')) return 'resume'
  return 'jobs'
}

function navClass(active: boolean) {
  return `inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 sm:h-9 ${
    active ? 'bg-subtle text-ink' : 'text-muted hover:bg-subtle hover:text-ink'
  }`
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [reference, setReference] = useState<Reference | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState<Page>(pageFromHash)

  const load = useCallback(async () => {
    setError('')
    try {
      const [s, r] = await Promise.all([api.state(), api.reference()])
      setState(s)
      setReference(r)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Loading failed.')
    }
  }, [])

  useEffect(() => {
    void load()
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [load])

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center px-5">
        <div className="card max-w-md p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
            <WifiOff aria-hidden className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Shortlist isn't responding</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Button className="mt-6" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 pt-28" role="status" aria-label="Opening Shortlist">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    )
  }

  if (!state.profile.setup_complete) {
    return (
      <Setup
        state={state}
        reference={reference}
        onState={setState}
        onDone={() => {
          window.location.hash = '#/jobs'
          void load()
        }}
      />
    )
  }

  const initial = (state.profile.name || 'Y').charAt(0).toUpperCase()
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#/jobs" aria-label="Shortlist home">
            <Logo />
          </a>
          <div className="flex items-center gap-2">
            <nav aria-label="Main" className="flex gap-1">
              <a href="#/jobs" aria-current={page === 'jobs' ? 'page' : undefined} className={navClass(page === 'jobs')}>
                <LayoutList aria-hidden className="size-4" />
                Jobs
              </a>
              <a href="#/resume" aria-current={page === 'resume' ? 'page' : undefined} className={navClass(page === 'resume')}>
                <FileSearch aria-hidden className="size-4" />
                Resume score
              </a>
              <a href="#/settings" aria-current={page === 'settings' ? 'page' : undefined} className={navClass(page === 'settings')}>
                <SettingsIcon aria-hidden className="size-4" />
                Settings
              </a>
            </nav>
            <ThemeToggle />
            <span
              aria-hidden
              className="ml-1 hidden size-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-sm font-semibold text-white sm:grid"
            >
              {initial}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-8 pb-24 sm:px-8 sm:pt-10">
        {page === 'jobs' ? (
          <Dashboard state={state} onState={setState} />
        ) : page === 'resume' ? (
          <AtsPortal state={state} />
        ) : (
          <Settings state={state} reference={reference} onState={setState} />
        )}
      </main>
    </div>
  )
}
