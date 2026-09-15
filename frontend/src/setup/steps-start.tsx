import { Briefcase, FileText, Lock, Mail, Plus, Radar, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { api, ApiError } from '../api'
import { TagInput } from '../ui/TagInput'
import { Badge, Button, Chip, ExternalLink, Field, IconTile, Marked, Notice, Spinner } from '../ui/ui'
import { useFlow } from './flow'
import { KeyForm } from './KeyForm'
import { StepShell } from './StepShell'

const FEATURES = [
  { icon: Radar, title: 'Searches everywhere', text: 'Job boards, Google for Jobs and company career pages, every day.' },
  { icon: Sparkles, title: 'Reads every posting', text: 'AI checks each job against your resume, level and visa needs.' },
  { icon: Mail, title: 'Sends the short list', text: 'Only the jobs worth applying to, ranked, in your inbox.' },
]

export function WelcomeStep() {
  return (
    <div>
      <div className="mx-auto max-w-3xl text-center">
        <Badge tone="brand" icon={ShieldCheck}>
          Runs on your computer. Your data stays with you.
        </Badge>
        <StepShellHero />
      </div>

      <ul className="mt-14 grid gap-4 sm:grid-cols-3">
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
      submitLabel="Start setup"
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
      const updated = await api.uploadResume(file)
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
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Spinner className="size-6" />
              </span>
              <p className="font-medium">Reading your resume</p>
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
  const [selected, setSelected] = useState<string[]>(p.titles.length ? p.titles : p.suggested_titles.slice(0, 3))
  const [custom, setCustom] = useState('')

  const options = [...p.suggested_titles, ...selected.filter((t) => !p.suggested_titles.includes(t))]

  function toggle(t: string) {
    setSelected((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
  }

  function addCustom() {
    const t = custom.trim()
    if (t && !selected.some((s) => s.toLowerCase() === t.toLowerCase())) setSelected((cur) => [...cur, t])
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
        {p.suggested_titles.length > 0 && (
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
          <Field
            label="Add a title"
            className="flex-1"
            placeholder="e.g. Product Analyst"
            value={custom}
            maxLength={80}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
          />
          <Button variant="secondary" icon={Plus} onClick={addCustom} disabled={!custom.trim()}>
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
