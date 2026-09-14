import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type AppState, type Reference } from './api'
import { Dashboard } from './jobs/Dashboard'
import { Settings } from './settings/Settings'
import { Setup } from './setup/Setup'
import { Button } from './ui/ui'

type Page = 'jobs' | 'settings'

function pageFromHash(): Page {
  return window.location.hash.startsWith('#/settings') ? 'settings' : 'jobs'
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
      <div className="mx-auto max-w-xl px-5 pt-28">
        <h1 className="text-title font-semibold">Shortlist isn't responding</h1>
        <p className="mt-4 text-graphite">{error}</p>
        <div className="mt-8">
          <Button onClick={() => void load()}>Try again</Button>
        </div>
      </div>
    )
  }

  if (!state) {
    return <p className="px-5 pt-28 text-center text-graphite">Opening Shortlist</p>
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

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <a href="#/jobs" className="text-[1.05rem] font-semibold">
          <span className="marker">Shortlist</span>
        </a>
        <nav aria-label="Main" className="flex gap-6 text-[0.95rem]">
          <a href="#/jobs" aria-current={page === 'jobs' ? 'page' : undefined} className={page === 'jobs' ? 'text-ink' : 'text-graphite hover:text-ink'}>
            Jobs
          </a>
          <a
            href="#/settings"
            aria-current={page === 'settings' ? 'page' : undefined}
            className={page === 'settings' ? 'text-ink' : 'text-graphite hover:text-ink'}
          >
            Settings
          </a>
        </nav>
      </header>
      <main className="pt-8 pb-24 sm:pt-12">
        {page === 'jobs' ? (
          <Dashboard state={state} onState={setState} />
        ) : (
          <Settings state={state} reference={reference} onState={setState} />
        )}
      </main>
    </div>
  )
}
