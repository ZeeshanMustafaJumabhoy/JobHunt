import { useState } from 'react'
import { api, ApiError, type AppState, type KeyStatus, type Profile, type Reference } from '../api'
import { FlowProvider } from '../setup/flow'
import { EmailStep, SourcesStep } from '../setup/steps-finish'
import {
  ExclusionsStep,
  ExperienceStep,
  FreshnessStep,
  PlacesStep,
  SalaryStep,
  VisaStep,
  WorkModeStep,
} from '../setup/steps-prefs'
import { AiKeyStep, ResumeStep, TitlesStep } from '../setup/steps-start'
import { Button, Notice } from '../ui/ui'

const SECTIONS = [
  { id: 'titles', label: 'Job titles', render: () => <TitlesStep /> },
  { id: 'resume', label: 'Resume and skills', render: () => <ResumeStep /> },
  { id: 'work', label: 'Work arrangement', render: () => <WorkModeStep /> },
  { id: 'places', label: 'Countries', render: () => <PlacesStep /> },
  { id: 'visa', label: 'Visa', render: () => <VisaStep /> },
  { id: 'experience', label: 'Experience', render: () => <ExperienceStep /> },
  { id: 'salary', label: 'Salary', render: () => <SalaryStep /> },
  { id: 'exclusions', label: 'Exclusions', render: () => <ExclusionsStep /> },
  { id: 'freshness', label: 'Recency', render: () => <FreshnessStep /> },
  { id: 'sources', label: 'Job sources', render: () => <SourcesStep /> },
  { id: 'email', label: 'Email', render: () => <EmailStep /> },
  { id: 'ai', label: 'AI keys', render: () => <AiKeyStep /> },
]

export function Settings({
  state,
  reference,
  onState,
}: {
  state: AppState
  reference: Reference | null
  onState: (s: AppState) => void
}) {
  const [clearing, setClearing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const setProfile = (p: Profile) => onState({ ...state, profile: p })
  const setKeys = (k: Record<string, KeyStatus>) => onState({ ...state, keys: k })

  async function clear() {
    setClearing(true)
    try {
      await api.clearHistory()
      onState(await api.state())
      setMsg({ ok: true, text: 'Found jobs and search history are cleared. The next search starts fresh.' })
      setConfirm(false)
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Clearing failed.' })
    } finally {
      setClearing(false)
    }
  }

  return (
    <FlowProvider value={{ mode: 'settings', state, reference, setProfile, setKeys, next: () => {}, back: () => {} }}>
      <div className="grid gap-x-16 lg:grid-cols-[12rem_1fr]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-8 space-y-1 text-[0.95rem]">
            {[...SECTIONS, { id: 'history', label: 'History' }].map((s) => (
              <li key={s.id}>
                {/* Buttons, not #anchors: the hash is the app's page route. */}
                <button
                  type="button"
                  onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
                  className="block py-1 text-left text-graphite hover:text-ink"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h1 className="text-title font-semibold sm:text-display">Settings</h1>
          <p className="mt-3 text-graphite">Changes apply from the next search.</p>
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-8 border-b border-rule py-12">
              {s.render()}
            </section>
          ))}
          <section id="history" className="scroll-mt-8 py-12">
            <h2 className="text-xl font-semibold">Search history</h2>
            <p className="mt-2 max-w-[60ch] text-graphite">
              Shortlist remembers every job it has read so it never pays to read one twice. Clearing this lets the next
              search read everything again, and removes your saved and applied lists.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {confirm ? (
                <>
                  <Button variant="quiet" onClick={clear} busy={clearing} className="border-alert text-alert">
                    Yes, clear everything
                  </Button>
                  <Button variant="plain" onClick={() => setConfirm(false)}>
                    Keep it
                  </Button>
                </>
              ) : (
                <Button variant="quiet" onClick={() => setConfirm(true)}>
                  Clear found jobs
                </Button>
              )}
              {msg && <Notice tone={msg.ok ? 'ok' : 'error'}>{msg.text}</Notice>}
            </div>
          </section>
        </div>
      </div>
    </FlowProvider>
  )
}
