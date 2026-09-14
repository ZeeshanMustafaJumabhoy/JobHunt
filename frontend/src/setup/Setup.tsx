import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api, type AppState, type KeyStatus, type Profile, type Reference } from '../api'
import { FlowProvider } from './flow'
import { AiKeyStep, ResumeStep, TitlesStep, WelcomeStep } from './steps-start'
import {
  ExclusionsStep,
  ExperienceStep,
  FreshnessStep,
  PlacesStep,
  SalaryStep,
  VisaStep,
  WorkModeStep,
} from './steps-prefs'
import { EmailStep, ReviewStep, SourcesStep } from './steps-finish'

const STEPS = [
  { id: 'welcome', group: '' },
  { id: 'ai', group: 'AI key' },
  { id: 'resume', group: 'Resume' },
  { id: 'titles', group: 'Job titles' },
  { id: 'work', group: 'Preferences' },
  { id: 'places', group: 'Preferences' },
  { id: 'visa', group: 'Preferences' },
  { id: 'experience', group: 'Preferences' },
  { id: 'salary', group: 'Preferences' },
  { id: 'exclusions', group: 'Preferences' },
  { id: 'freshness', group: 'Preferences' },
  { id: 'sources', group: 'Job sources' },
  { id: 'email', group: 'Email' },
  { id: 'review', group: 'Review' },
] as const

type StepId = (typeof STEPS)[number]['id']
const GROUPS = [...new Set(STEPS.map((s) => s.group).filter(Boolean))]

/** The furthest step reachable with the answers given so far. */
function furthestStep(state: AppState): number {
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
  const heading = useRef<HTMLDivElement>(null)

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
    api.patchProfile({ setup_step: STEPS[clamped].id }).catch(() => {})
  }

  useEffect(() => {
    // Move focus to the new question for keyboard and screen reader users.
    heading.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
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
    const profile = await api.patchProfile({ setup_complete: true, setup_step: 'review' })
    onState({ ...latest.current, profile })
    await api.startRun()
    onDone()
  }

  const step = STEPS[index]
  const render: Record<StepId, () => React.ReactNode> = {
    welcome: () => <WelcomeStep />,
    ai: () => <AiKeyStep />,
    resume: () => <ResumeStep />,
    titles: () => <TitlesStep />,
    work: () => <WorkModeStep />,
    places: () => <PlacesStep />,
    visa: () => <VisaStep />,
    experience: () => <ExperienceStep />,
    salary: () => <SalaryStep />,
    exclusions: () => <ExclusionsStep />,
    freshness: () => <FreshnessStep />,
    sources: () => <SourcesStep />,
    email: () => <EmailStep />,
    review: () => (
      <ReviewStep goTo={(id) => go(STEPS.findIndex((s) => s.id === id))} onFinish={finish} />
    ),
  }

  const currentGroup = step.group
  const prefSteps = STEPS.filter((s) => s.group === 'Preferences')
  const prefPos = prefSteps.findIndex((s) => s.id === step.id)

  return (
    <FlowProvider
      value={{ mode: 'setup', state, reference, setProfile, setKeys, next: () => go(index + 1), back: () => go(index - 1) }}
    >
      <div className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 gap-x-16 px-5 sm:px-8 lg:grid-cols-[13rem_1fr]">
        <aside className="pt-8 lg:sticky lg:top-0 lg:h-dvh lg:pt-14">
          <p className="text-[1.05rem] font-semibold">
            <span className="marker">Shortlist</span>
          </p>
          {index > 0 && (
            <nav aria-label="Setup progress" className="mt-12 hidden lg:block">
              <ol className="space-y-1">
                {GROUPS.map((g, i) => {
                  const groupStart = STEPS.findIndex((s) => s.group === g)
                  const done = STEPS.findLastIndex((s) => s.group === g) < index
                  const current = g === currentGroup
                  const reachable = groupStart <= limit
                  return (
                    <li key={g}>
                      <button
                        type="button"
                        disabled={!reachable}
                        onClick={() => go(groupStart)}
                        aria-current={current ? 'step' : undefined}
                        className={`flex w-full items-baseline gap-3 py-1.5 text-left text-[0.95rem] transition-colors duration-150 disabled:cursor-default ${
                          current ? 'font-medium text-ink' : done ? 'text-graphite hover:text-ink' : 'text-faint'
                        }`}
                      >
                        <span className="w-4 text-sm tabular-nums">{done ? '✓' : i + 1}</span>
                        {g}
                      </button>
                      {current && g === 'Preferences' && (
                        <p className="pb-1 pl-7 text-sm text-graphite">
                          Question {prefPos + 1} of {prefSteps.length}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
          )}
        </aside>

        <main className="pt-10 pb-24 lg:pt-28">
          {index > 0 && (
            <p className="mb-6 text-sm text-graphite lg:hidden">
              {currentGroup}
              {currentGroup === 'Preferences' ? `, question ${prefPos + 1} of ${prefSteps.length}` : ''}
            </p>
          )}
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step.id}
              ref={heading}
              custom={direction}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 * direction }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="[&_h1]:outline-none"
            >
              {render[step.id]()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </FlowProvider>
  )
}
