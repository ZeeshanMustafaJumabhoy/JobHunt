import { useRef, useState, type DragEvent } from 'react'
import { api, ApiError } from '../api'
import { TagInput } from '../ui/TagInput'
import { Button, Chip, ExternalLink, Field, Marked, Notice, Spinner } from '../ui/ui'
import { useFlow } from './flow'
import { KeyForm } from './KeyForm'
import { StepShell } from './StepShell'

export function WelcomeStep() {
  return (
    <StepShell
      title="Find the jobs you can actually get."
      showBack={false}
      submitLabel="Start setup"
      lede={
        <>
          <p>
            Shortlist searches job boards and company career pages every day, reads each posting against your resume,
            and keeps the ones worth applying to. Setup takes about ten minutes.
          </p>
        </>
      }
    >
      <div className="grid max-w-2xl gap-8 border-t border-rule pt-8 sm:grid-cols-2">
        <div>
          <h2 className="font-semibold">You'll need</h2>
          <ul className="mt-3 space-y-2 text-graphite">
            <li>A free Groq account, for the AI that reads postings</li>
            <li>Your resume as a PDF or Word file</li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">What stays on this computer</h2>
          <p className="mt-3 text-graphite">
            Your keys are saved in the project's <code className="text-ink">.env</code> file and your profile in{' '}
            <code className="text-ink">data/</code>. Your resume is only sent to Groq, to be read.
          </p>
        </div>
      </div>
    </StepShell>
  )
}

export function AiKeyStep() {
  const { state } = useFlow()
  const [showBackup, setShowBackup] = useState(state.keys.OPENROUTER_API_KEY?.set ?? false)

  return (
    <StepShell
      title="Connect the AI"
      lede="Groq runs the AI that reads your resume and every job posting. Its free plan is enough for daily searches, and nothing else in setup works until this key is saved."
      canSubmit={state.keys.GROQ_API_KEY?.set}
    >
      <div className="max-w-xl">
        <ol className="mb-8 space-y-2.5 text-[0.95rem] text-graphite">
          <li className="flex gap-3">
            <span className="w-4 shrink-0 text-faint">1.</span>
            <span>
              Sign in at <ExternalLink href="https://console.groq.com/keys">console.groq.com/keys</ExternalLink>. Google
              sign-in works.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-4 shrink-0 text-faint">2.</span>
            <span>Choose Create API Key, name it Shortlist, and copy the key. It starts with gsk_.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-4 shrink-0 text-faint">3.</span>
            <span>Paste it below. Shortlist checks it with Groq before saving it.</span>
          </li>
        </ol>
        <KeyForm
          service="groq"
          envKey="GROQ_API_KEY"
          fields={[{ name: 'key', label: 'Groq API key', placeholder: 'gsk_…' }]}
        />

        <div className="mt-10 border-t border-rule pt-6">
          {showBackup ? (
            <>
              <h2 className="font-semibold">Backup AI key</h2>
              <p className="mt-1 mb-4 text-sm text-graphite">
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
            <Button variant="plain" onClick={() => setShowBackup(true)}>
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

  async function save() {
    const n = years.trim() === '' ? null : Number(years)
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 60)) throw new Error('Years of experience should be a number from 0 to 60.')
    setProfile(await api.patchProfile({ skills, years_experience: n }))
  }

  return (
    <StepShell
      title="Add your resume"
      lede="The AI reads it once to learn your skills and experience. You can correct anything it gets wrong."
      canSubmit={p.has_resume && !busy}
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
          className={`flex flex-col items-start gap-3 rounded-lg border border-dashed px-6 py-7 transition-colors duration-150 ${
            dragging ? 'border-pen bg-sheet' : 'border-rule'
          }`}
        >
          {busy ? (
            <p className="flex items-center gap-3 text-[0.95rem]">
              <Spinner /> Reading your resume. This takes up to half a minute.
            </p>
          ) : (
            <>
              <p className="text-[0.95rem]">
                {p.has_resume ? 'Upload a newer version to read it again.' : 'Drop a PDF, DOCX or TXT file here, or'}
              </p>
              <Button variant="quiet" onClick={() => input.current?.click()}>
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
          <div className="mt-10 space-y-8">
            <div>
              <p className="text-xl leading-snug font-semibold">
                {p.name || 'Your resume'}
                {p.headline && <span className="font-normal text-graphite">, {p.headline}</span>}
              </p>
              {p.summary && <p className="mt-3 max-w-[62ch] leading-relaxed text-graphite">{p.summary}</p>}
            </div>

            {justRead && skills.length > 0 && (
              <p className="text-[1.05rem] leading-loose" aria-live="polite">
                Found{' '}
                {skills.slice(0, 6).map((s, i) => (
                  <span key={s}>
                    <Marked delay={0.15 + i * 0.12}>{s}</Marked>
                    {i < Math.min(skills.length, 6) - 1 ? ', ' : ''}
                  </span>
                ))}
                {skills.length > 6 && <span className="text-graphite"> and {skills.length - 6} more.</span>}
              </p>
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
      lede="Pick the titles you'd apply for. The first five become search terms; similar titles are matched automatically, so SDET also finds Engineer in Test."
      canSubmit={selected.length > 0}
      onSubmit={async () => setProfile(await api.saveTitles(selected.slice(0, 15)))}
    >
      <div className="max-w-2xl">
        {p.suggested_titles.length > 0 && <h2 className="mb-3 text-sm font-medium">Suggested from your resume</h2>}
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
          <Button variant="quiet" onClick={addCustom} disabled={!custom.trim()}>
            Add
          </Button>
        </div>
        <p className="mt-6 text-sm text-graphite">
          {selected.length === 0
            ? 'Pick at least one.'
            : `${selected.length} selected${selected.length > 5 ? '. Searches use the first five.' : '.'}`}
        </p>
      </div>
    </StepShell>
  )
}
