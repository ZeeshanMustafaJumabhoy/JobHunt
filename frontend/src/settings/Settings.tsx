import {
  Ban,
  Briefcase,
  CalendarDays,
  FileText,
  Globe,
  History,
  KeyRound,
  Laptop,
  Mail,
  Percent,
  Plane,
  Radar,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api, ApiError, type AppState, type KeyStatus, type Profile, type Reference } from '../api'
import { FlowProvider } from '../setup/flow'
import { EmailStep, SourcesStep } from '../setup/steps-finish'
import {
  ExclusionsStep,
  ExperienceStep,
  FreshnessStep,
  MatchStep,
  PlacesStep,
  SalaryStep,
  VisaStep,
  WorkModeStep,
} from '../setup/steps-prefs'
import { AiKeyStep, ResumeStep, TitlesStep } from '../setup/steps-start'
import { Button, Notice } from '../ui/ui'

const SECTIONS: { id: string; label: string; icon: LucideIcon; render: () => ReactNode }[] = [
  { id: 'titles', label: 'Job titles', icon: Briefcase, render: () => <TitlesStep /> },
  { id: 'resume', label: 'Resume and skills', icon: FileText, render: () => <ResumeStep /> },
  { id: 'work', label: 'Work arrangement', icon: Laptop, render: () => <WorkModeStep /> },
  { id: 'places', label: 'Countries', icon: Globe, render: () => <PlacesStep /> },
  { id: 'visa', label: 'Visa', icon: Plane, render: () => <VisaStep /> },
  { id: 'experience', label: 'Experience', icon: TrendingUp, render: () => <ExperienceStep /> },
  { id: 'match', label: 'Match threshold', icon: Percent, render: () => <MatchStep /> },
  { id: 'salary', label: 'Salary', icon: Wallet, render: () => <SalaryStep /> },
  { id: 'exclusions', label: 'Exclusions', icon: Ban, render: () => <ExclusionsStep /> },
  { id: 'freshness', label: 'Recency', icon: CalendarDays, render: () => <FreshnessStep /> },
  { id: 'sources', label: 'Job sources', icon: Radar, render: () => <SourcesStep /> },
  { id: 'email', label: 'Email', icon: Mail, render: () => <EmailStep /> },
  { id: 'ai', label: 'AI keys', icon: KeyRound, render: () => <AiKeyStep /> },
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
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">Settings</h1>
        <p className="mt-1 text-muted">Changes apply from the next search.</p>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="card sticky top-24 space-y-0.5 p-2">
            {[...SECTIONS, { id: 'history', label: 'History', icon: History }].map((s) => (
              <li key={s.id}>
                {/* Buttons, not #anchors: the hash is the app's page route. */}
                <button
                  type="button"
                  onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
                >
                  <s.icon aria-hidden className="size-4 text-faint" />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-24 p-6 sm:p-8">
              {s.render()}
            </section>
          ))}
          <section id="history" className="card scroll-mt-24 border-danger/20 p-6 sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight">Search history</h2>
            <p className="mt-1 max-w-[60ch] text-sm text-muted">
              Shortlist remembers every job it has read so it never pays to read one twice. Clearing this lets the next search
              read everything again, and removes your saved and applied lists.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {confirm ? (
                <>
                  <Button variant="danger" onClick={clear} busy={clearing}>
                    Yes, clear everything
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(false)}>
                    Keep it
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setConfirm(true)}>
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
