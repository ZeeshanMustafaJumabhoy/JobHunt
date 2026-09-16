import { Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type AppState, type KeyStatus, type Profile, type Reference } from '../api'
import { Badge, Logo, ThemeToggle } from '../ui/ui'
import { FlowProvider } from './flow'
import { isPreviewMode } from '../preview'
import { EmailStep, ReviewStep, SourcesStep } from './steps-finish'
import {
  ExclusionsStep,
  ExperienceStep,
  FreshnessStep,
  MatchStep,
  PlacesStep,
  SalaryStep,
  VisaStep,
  WorkModeStep,
} from './steps-prefs'
import { AiKeyStep, ResumeStep, TitlesStep, WelcomeStep } from './steps-start'

const STEPS = [
  { id: 'welcome', group: '' },
  { id: 'ai', group: 'AI key' },
  { id: 'resume', group: 'Resume' },
  { id: 'titles', group: 'Job titles' },
  { id: 'work', group: 'Preferences' },
  { id: 'places', group: 'Preferences' },
  { id: 'visa', group: 'Preferences' },
  { id: 'experience', group: 'Preferences' },
  { id: 'match', group: 'Preferences' },
  { id: 'salary', group: 'Preferences' },
  { id: 'exclusions', group: 'Preferences' },
  { id: 'freshness', group: 'Preferences' },
  { id: 'sources', group: 'Job sources' },
  { id: 'email', group: 'Email' },
  { id: 'review', group: 'Review' },
] as const

type StepId = (typeof STEPS)[number]['id']
const GROUPS = [...new Set(STEPS.map((s) => s.group).filter(Boolean))]
const GROUP_HINT: Record<string, string> = {
  'AI key': 'Connect Groq',
  Resume: 'Skills and experience',
  'Job titles': 'What to search for',
  Preferences: 'Where, how, how much',
  'Job sources': 'Boards and career pages',
  Email: 'Daily digest, optional',
  Review: 'Check and start',
}

/** The furthest step reachable with the answers given so far. */
function furthestStep(state: AppState): number {
  if (isPreviewMode()) return STEPS.length - 1
  const at = (id: StepId) => STEPS.findIndex((s) => s.id === id)
  if (!state.keys.GROQ_API_KEY?.set) return at('ai')
  if (!state.profile.has_resume) return at('resume')
  if (!state.profile.titles.length) return at('titles')
  return STEPS.length - 1
}

export function Setup({
  state,
  reference,
  onState,
  onDone,
}: {
  state: AppState
  reference: Reference | null
  onState: (s: AppState) => void
  onDone: () => void
}) {
  const reduce = useReducedMotion()
  const saved = STEPS.findIndex((s) => s.id === state.profile.setup_step)
  const [index, setIndex] = useState(() => Math.max(0, Math.min(saved, furthestStep(state))))
  const [direction, setDirection] = useState(1)
  const container = useRef<HTMLDivElement>(null)

  const limit = furthestStep(state)
  // Steps save and then advance in the same tick, before React re-renders with
  // the new answer, so navigation reads the latest state through a ref.
  const latest = useRef(state)
  latest.current = state

  function go(to: number) {
    const clamped = Math.max(0, Math.min(to, furthestStep(latest.current)))
    setDirection(clamped >= index ? 1 : -1)
    setIndex(clamped)
    // Remember the step so closing the tab resumes here. Failure is harmless.
    // Skipped in preview mode: browsing around shouldn't overwrite real progress.
    if (!isPreviewMode()) api.patchProfile({ setup_step: STEPS[clamped].id }).catch(() => {})
  }

  useEffect(() => {
    // Move focus to the new question for keyboard and screen reader users.
    container.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [index])

  const setProfile = (p: Profile) => {
    latest.current = { ...latest.current, profile: p }
    onState(latest.current)
  }
  const setKeys = (k: Record<string, KeyStatus>) => {
    latest.current = { ...latest.current, keys: k, ai_ready: Boolean(k.GROQ_API_KEY?.set || k.OPENROUTER_API_KEY?.set) }
    onState(latest.current)
  }

  async function finish() {
    // Preview mode never had a real key or resume to run a real search with —
    // just hand off to the dashboard, which shows stand-in jobs of its own.
    if (isPreviewMode()) {
      onDone()
      return
    }
    const profile = await api.patchProfile({ setup_complete: true, setup_step: 'review' })
    onState({ ...latest.current, profile })
    await api.startRun()
    onDone()
  }

  const step = STEPS[index]
  const render: Record<StepId, () => ReactNode> = {
    welcome: () => <WelcomeStep />,
    ai: () => <AiKeyStep />,
    resume: () => <ResumeStep />,
    titles: () => <TitlesStep />,
    work: () => <WorkModeStep />,
    places: () => <PlacesStep />,
    visa: () => <VisaStep />,
    experience: () => <ExperienceStep />,
    match: () => <MatchStep />,
    salary: () => <SalaryStep />,
    exclusions: () => <ExclusionsStep />,
    freshness: () => <FreshnessStep />,
    sources: () => <SourcesStep />,
    email: () => <EmailStep />,
    review: () => <ReviewStep goTo={(id) => go(STEPS.findIndex((s) => s.id === id))} onFinish={finish} />,
  }

  const currentGroup = step.group
  const prefSteps = STEPS.filter((s) => s.group === 'Preferences')
  const prefPos = prefSteps.findIndex((s) => s.id === step.id)
  const total = STEPS.length - 1
  // The header counts the same groups the sidebar numbers (1 of 7), not every
  // individual question inside "Preferences" — those get their own sub-count.
  const groupNumber = GROUPS.indexOf(currentGroup) + 1
  const isWelcome = index === 0
  const preview = isPreviewMode()

  const content = (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={step.id}
        ref={container}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      >
        {render[step.id]()}
      </motion.div>
    </AnimatePresence>
  )

  return (
    <FlowProvider
      value={{ mode: 'setup', state, reference, setProfile, setKeys, next: () => go(index + 1), back: () => go(index - 1) }}
    >
      <div className={`min-h-dvh ${isWelcome ? 'brand-wash' : ''}`}>
        <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
            <Logo />
            <div className="flex items-center gap-3">
              {preview && <Badge tone="warning">Preview — nothing is saved</Badge>}
              {!isWelcome && (
                <span className="text-sm text-muted tabular-nums">
                  Step {groupNumber} of {GROUPS.length}
                </span>
              )}
              <ThemeToggle />
            </div>
          </div>
          {!isWelcome && (
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={index}
              className="h-0.5 bg-line/60"
            >
              <div
                className="h-full origin-left bg-gradient-to-r from-brand to-brand-2 transition-transform duration-500 ease-out-quart"
                style={{ transform: `scaleX(${index / total})` }}
              />
            </div>
          )}
        </header>

        {isWelcome ? (
          <main className="mx-auto max-w-5xl px-5 pt-14 pb-24 sm:px-8 sm:pt-20">{content}</main>
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 pt-8 pb-24 sm:px-8 lg:grid-cols-[17rem_1fr] lg:pt-12">
            <aside className="hidden lg:block">
              <nav aria-label="Setup steps" className="card sticky top-24 p-3">
                <ol>
                  {GROUPS.map((g, i) => {
                    const groupStart = STEPS.findIndex((s) => s.group === g)
                    const groupEnd = STEPS.findLastIndex((s) => s.group === g)
                    const done = groupEnd < index
                    const current = g === currentGroup
                    const reachable = groupStart <= limit
                    return (
                      <li key={g} className="relative">
                        {i < GROUPS.length - 1 && (
                          <span
                            aria-hidden
                            className={`absolute top-11 bottom-[-0.25rem] left-[1.6rem] w-px ${done ? 'bg-brand/40' : 'bg-line'}`}
                          />
                        )}
                        <button
                          type="button"
                          disabled={!reachable}
                          onClick={() => go(groupStart)}
                          aria-current={current ? 'step' : undefined}
                          className={`relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150 disabled:cursor-default ${
                            current ? 'bg-brand-soft/70' : reachable ? 'hover:bg-subtle' : ''
                          }`}
                        >
                          {current && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" />}
                          <span
                            className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors ${
                              done
                                ? 'bg-brand text-white dark:text-canvas'
                                : current
                                  ? 'bg-surface text-brand-ink ring-1 ring-brand/60'
                                  : 'bg-subtle text-faint'
                            }`}
                          >
                            {done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
                          </span>
                          <span className="min-w-0">
                            <span className={`block text-sm font-medium ${current ? 'text-brand-ink' : done ? 'text-ink' : 'text-muted'}`}>
                              {g}
                            </span>
                            <span className="block truncate text-xs text-faint">
                              {current && g === 'Preferences'
                                ? `Question ${prefPos + 1} of ${prefSteps.length}`
                                : GROUP_HINT[g]}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </nav>
            </aside>

            <main className="min-w-0">
              <p className="mb-3 text-sm font-medium text-brand lg:hidden">
                {currentGroup}
                {currentGroup === 'Preferences' ? `, question ${prefPos + 1} of ${prefSteps.length}` : ''}
              </p>
              <div className="card min-w-0 p-5 sm:p-10">{content}</div>
            </main>
          </div>
        )}
      </div>
    </FlowProvider>
  )
}
