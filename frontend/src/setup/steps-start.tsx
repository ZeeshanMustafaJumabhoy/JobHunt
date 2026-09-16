import { Briefcase, FileText, HandHeart, Lock, Mail, Plus, Radar, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { api, ApiError, type Profile } from '../api'
import { TagInput } from '../ui/TagInput'
import { Badge, Button, Chip, ExternalLink, Field, IconTile, Marked, Notice } from '../ui/ui'
import { Loader } from '../ui/Loader'
import { useFlow } from './flow'
import { COMMON_JOB_TITLES } from './jobTitles'
import { KeyForm } from './KeyForm'
import { isPreviewMode } from './preview'
import { StepShell } from './StepShell'

/** Preview mode has no real resume to read, so it has nothing to suggest here
 * on its own — these stand in so the "suggested" UI is still visible to check. */
const PREVIEW_SUGGESTED_TITLES = ['QA Engineer', 'SDET', 'Test Automation Engineer', 'QA Lead', 'Software Tester']

/** A fake "AI read your resume" result, so preview mode has a Loader to
 * actually watch instead of skipping straight to the result. Never persisted. */
function fakeUpload(current: Profile): Promise<Profile> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          ...current,
          has_resume: true,
          name: 'Sara Khan',
          headline: 'QA Engineer, test automation',
          summary:
            'QA engineer with four years testing web applications, focused on test automation and release quality. Comfortable with Selenium, Python and CI pipelines.',
          skills: ['Selenium', 'Python', 'CI/CD', 'Manual Testing', 'API Testing', 'Test Strategy'],
          years_experience: 4,
          seniority: 'mid',
          suggested_titles: PREVIEW_SUGGESTED_TITLES,
        }),
      3000,
    ),
  )
}

const FEATURES = [
  { icon: Radar, title: 'Searches everywhere', text: 'Job boards, Google for Jobs and company career pages, every day.' },
  { icon: Sparkles, title: 'Reads every posting', text: 'AI checks each job against your resume, level and visa needs.' },
  { icon: Mail, title: 'Sends the short list', text: 'Only the jobs worth applying to, ranked, in your inbox.' },
]

/** Two ayat and two proverbs about hardship and getting back up, shown once,
 * up top, before anything else — this app exists because of layoffs. */
const MOTIVATION: { arabic?: string; text: string; ref: string }[] = [
  { arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', text: 'So indeed, with hardship comes ease.', ref: 'Qur’an 94:5, Ash-Sharh' },
  {
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    text: 'And whoever puts their trust in Allah — He is sufficient for them.',
    ref: 'Qur’an 65:3, At-Talaq',
  },
  { text: 'Fall seven times, stand up eight.', ref: 'Japanese proverb' },
  { text: 'This too shall pass.', ref: 'Persian proverb' },
]

export function WelcomeStep() {
  return (
    <div>
      <div className="hero-panel px-5 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <img src="/logo.png" alt="" className="mx-auto size-14 rounded-2xl shadow-pop sm:size-16" />
          <div className="mt-6">
            <Badge tone="brand" icon={ShieldCheck}>
              Runs on your computer. Your data stays with you.
            </Badge>
          </div>

          <ul className="mx-auto mt-8 grid gap-3 text-left sm:grid-cols-2">
            {MOTIVATION.map((m) => (
              <li key={m.ref} className="hero-quote">
                {m.arabic && <p dir="rtl" lang="ar" className="text-right text-xl leading-relaxed">{m.arabic}</p>}
                <p className={`text-[0.9375rem] leading-relaxed text-muted ${m.arabic ? 'mt-2' : ''}`}>{m.text}</p>
                <p className="mt-2 text-xs font-medium text-brand-2">{m.ref}</p>
              </li>
            ))}
          </ul>

          <StepShellHero />
        </div>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="card p-5 transition-shadow duration-200 hover:shadow-raised">
            <IconTile icon={f.icon} />
            <h2 className="mt-4 font-semibold tracking-tight">{f.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p>
          </li>
        ))}
      </ul>

      <div className="card mt-4 grid gap-6 p-6 sm:grid-cols-2">
        <div className="flex gap-4">
          <IconTile icon={Briefcase} tone="neutral" />
          <div>
            <h2 className="font-semibold tracking-tight">You'll need</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              A free Groq account for the AI, and your resume as a PDF or Word file. About ten minutes.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <IconTile icon={Lock} tone="neutral" />
          <div>
            <h2 className="font-semibold tracking-tight">What stays private</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Keys are saved in this folder's <code className="rounded bg-subtle px-1 py-0.5 text-xs text-ink">.env</code>. Your
              resume is only sent to Groq, to be read.
            </p>
          </div>
        </div>
      </div>

      <div className="card mt-4 flex gap-4 border-brand/20 bg-brand-soft/40 p-6">
        <IconTile icon={HandHeart} />
        <div>
          <h2 className="font-semibold tracking-tight">One honest note</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Shortlist finds and ranks the jobs most worth your time — it doesn't apply for you. Getting the offer still
            means staying engaged with recruiters and hiring managers, following up, and showing up well in every
            conversation. Best of luck out there.
          </p>
        </div>
      </div>
    </div>
  )
}

function StepShellHero() {
  return (
    <StepShell
      title={
        <>
          Find the jobs <span className="text-gradient">you can actually get.</span>
        </>
      }
      lede={
        <p className="mx-auto">
          Shortlist searches for you every day, reads each posting against your resume, and keeps only the roles worth
          applying to.
        </p>
      }
      showBack={false}
      submitLabel="Let's start"
      heroLayout
    />
  )
}

export function AiKeyStep() {
  const { state } = useFlow()
  const [showBackup, setShowBackup] = useState(state.keys.OPENROUTER_API_KEY?.set ?? false)

  return (
    <StepShell
      eyebrow={<Badge tone="brand" icon={Sparkles}>Required</Badge>}
      title="Connect the AI"
      lede="Groq runs the AI that reads your resume and every job posting. Its free plan covers daily searches."
      canSubmit={state.keys.GROQ_API_KEY?.set}
    >
      <div className="max-w-xl">
        <ol className="mb-8 grid gap-3">
          {[
            <>
              Sign in at <ExternalLink href="https://console.groq.com/keys">console.groq.com/keys</ExternalLink>. Google sign-in works.
            </>,
            <>Choose Create API Key, name it Shortlist, and copy it. It starts with gsk_.</>,
            <>Paste it below. Shortlist checks it with Groq before saving.</>,
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3 text-[0.9375rem] text-muted">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink tabular-nums">
                {i + 1}
              </span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
        <KeyForm service="groq" envKey="GROQ_API_KEY" fields={[{ name: 'key', label: 'Groq API key', placeholder: 'gsk_…' }]} />

        <div className="mt-8 rounded-xl border border-dashed border-line-strong p-5">
          {showBackup ? (
            <>
              <h2 className="font-semibold tracking-tight">Backup AI key</h2>
              <p className="mt-1 mb-4 text-sm text-muted">
                Optional. When Groq's free limit runs out mid-search, OpenRouter takes over. Get a free key at{' '}
                <ExternalLink href="https://openrouter.ai/keys">openrouter.ai/keys</ExternalLink>.
              </p>
              <KeyForm
                service="openrouter"
                envKey="OPENROUTER_API_KEY"
                fields={[{ name: 'key', label: 'OpenRouter API key', placeholder: 'sk-or-…' }]}
              />
            </>
          ) : (
            <Button variant="ghost" icon={Plus} onClick={() => setShowBackup(true)}>
              Add a backup AI key (optional)
            </Button>
          )}
        </div>
      </div>
    </StepShell>
  )
}

const ACCEPT = '.pdf,.docx,.txt'

export function ResumeStep() {
  const { state, setProfile } = useFlow()
  const p = state.profile
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [justRead, setJustRead] = useState(false)
  const [skills, setSkills] = useState(p.skills)
  const [years, setYears] = useState(p.years_experience?.toString() ?? '')

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const updated = isPreviewMode() ? await fakeUpload(p) : await api.uploadResume(file)
      setProfile(updated)
      setSkills(updated.skills)
      setYears(updated.years_experience?.toString() ?? '')
      setJustRead(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void upload(e.dataTransfer.files[0])
  }

  const yearsValue = years.trim() === '' ? null : Number(years)
  const yearsError =
    yearsValue !== null && (Number.isNaN(yearsValue) || yearsValue < 0 || yearsValue > 60) ? 'Enter a number from 0 to 60.' : ''

  async function save() {
    setProfile(await api.patchProfile({ skills, years_experience: yearsValue }))
  }

  return (
    <StepShell
      title="Add your resume"
      lede="The AI reads it once to learn your skills and experience. You can correct anything it gets wrong."
      canSubmit={p.has_resume && !busy && !yearsError}
      onSubmit={save}
    >
      <div className="max-w-2xl">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ${
            dragging ? 'border-brand bg-brand-soft' : 'border-line-strong bg-subtle/50 hover:border-brand/50'
          }`}
        >
          {busy ? (
            <>
              <Loader size={56} message="Reading your resume..." />
              <p className="text-sm text-muted">This takes up to half a minute.</p>
            </>
          ) : (
            <>
              <span className="grid size-12 place-items-center rounded-2xl bg-surface text-brand shadow-card">
                {p.has_resume ? <FileText aria-hidden className="size-6" /> : <Upload aria-hidden className="size-6" />}
              </span>
              <p className="font-medium">{p.has_resume ? 'Resume added' : 'Drop your resume here'}</p>
              <p className="text-sm text-muted">{p.has_resume ? 'Upload a newer version to read it again.' : 'PDF, DOCX or TXT, up to 5 MB'}</p>
              <Button variant="secondary" size="sm" className="mt-1" onClick={() => input.current?.click()}>
                {p.has_resume ? 'Replace resume' : 'Choose a file'}
              </Button>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Resume file"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </div>
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        {p.has_resume && !busy && (
          <div className="mt-8 space-y-8">
            <div className="flex items-start gap-4 rounded-2xl bg-subtle/70 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-base font-semibold text-white">
                {(p.name || 'Y').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-lg font-semibold tracking-tight">
                  {p.name || 'Your resume'}
                  {p.headline && <span className="font-normal text-muted">, {p.headline}</span>}
                </p>
                {p.summary && <p className="mt-1.5 leading-relaxed text-muted">{p.summary}</p>}
              </div>
            </div>

            {justRead && skills.length > 0 && (
              <div aria-live="polite">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Sparkles aria-hidden className="size-4 text-brand" />
                  Found in your resume
                </p>
                <div className="flex flex-wrap gap-2">
                  {skills.slice(0, 8).map((s, i) => (
                    <Marked key={s} delay={0.08 + i * 0.06}>
                      {s}
                    </Marked>
                  ))}
                  {skills.length > 8 && <Badge>and {skills.length - 8} more</Badge>}
                </div>
              </div>
            )}

            <TagInput
              label="Skills"
              values={skills}
              onChange={setSkills}
              placeholder="Add a skill"
              hint="Jobs are matched against this list. Remove anything you wouldn't want to be hired for."
            />
            <Field
              label="Years of professional experience"
              inputMode="decimal"
              className="max-w-64"
              value={years}
              error={yearsError}
              onChange={(e) => setYears(e.target.value)}
            />
          </div>
        )}
      </div>
    </StepShell>
  )
}

export function TitlesStep() {
  const { state, setProfile } = useFlow()
  const p = state.profile
  const suggested = p.suggested_titles.length > 0 ? p.suggested_titles : isPreviewMode() ? PREVIEW_SUGGESTED_TITLES : []
  const [selected, setSelected] = useState<string[]>(p.titles.length ? p.titles : suggested.slice(0, 3))
  const [custom, setCustom] = useState('')

  const options = [...suggested, ...selected.filter((t) => !suggested.includes(t))]
  const titlePool = [...new Set([...suggested, ...COMMON_JOB_TITLES])]
  const query = custom.trim().toLowerCase()
  const matches = query
    ? titlePool.filter((t) => t.toLowerCase().includes(query) && !selected.some((s) => s.toLowerCase() === t.toLowerCase())).slice(0, 6)
    : []

  function toggle(t: string) {
    setSelected((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
  }

  function addTitle(t: string) {
    const trimmed = t.trim()
    if (trimmed && !selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) setSelected((cur) => [...cur, trimmed])
    setCustom('')
  }

  return (
    <StepShell
      title="Which jobs should it look for?"
      lede="Pick the titles you'd apply for. The first five become search terms, and similar titles are matched automatically."
      canSubmit={selected.length > 0}
      onSubmit={async () => setProfile(await api.saveTitles(selected.slice(0, 15)))}
    >
      <div className="max-w-2xl">
        {suggested.length > 0 && (
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden className="size-4 text-brand" />
            Suggested from your resume
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {options.map((t) => (
            <Chip key={t} selected={selected.includes(t)} onToggle={() => toggle(t)}>
              {t}
            </Chip>
          ))}
        </div>
        <div className="mt-8 flex max-w-lg items-end gap-2">
          <div className="relative flex-1">
            <Field
              label="Add a title"
              placeholder="e.g. Product Analyst"
              value={custom}
              maxLength={80}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTitle(custom)
                }
              }}
            />
            {matches.length > 0 && (
              <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                {matches.map((t) => (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => addTitle(t)}
                      className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[0.9375rem] hover:bg-subtle"
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button variant="secondary" icon={Plus} onClick={() => addTitle(custom)} disabled={!custom.trim()}>
            Add
          </Button>
        </div>
        <p className="mt-5 text-sm text-muted" aria-live="polite">
          {selected.length === 0
            ? 'Pick at least one.'
            : `${selected.length} selected${selected.length > 5 ? '. Searches use the first five.' : '.'}`}
        </p>
      </div>
    </StepShell>
  )
}
