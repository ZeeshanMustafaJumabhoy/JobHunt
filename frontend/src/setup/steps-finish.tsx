import { useState, type ReactNode } from 'react'
import { api, ApiError, type Profile } from '../api'
import { Button, ExternalLink, Field, Notice, Toggle } from '../ui/ui'
import { useFlow } from './flow'
import { KeyForm } from './KeyForm'
import { StepShell } from './StepShell'

function SourceBlock({
  name,
  status,
  children,
  open: initiallyOpen = false,
}: {
  name: string
  status: ReactNode
  children?: ReactNode
  open?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div className="border-b border-rule py-5 first:border-t">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[1.05rem] font-medium">{name}</h3>
        <div className="flex items-baseline gap-4 text-sm text-graphite">
          {status}
          {children && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="text-ink underline decoration-rule underline-offset-4 hover:decoration-graphite"
            >
              {open ? 'Close' : 'Set up'}
            </button>
          )}
        </div>
      </div>
      {open && children && <div className="mt-5 max-w-lg">{children}</div>}
    </div>
  )
}

export function SourcesStep() {
  const { state, setProfile } = useFlow()
  const p = state.profile
  const keys = state.keys
  const [sources, setSources] = useState(p.sources)
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [pageMsg, setPageMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const on = (k: keyof Profile['sources'], v: boolean) => setSources((s) => ({ ...s, [k]: v }))

  async function addPage() {
    setAdding(true)
    setPageMsg(null)
    try {
      const res = await api.addCareerPage(url)
      setProfile(res.profile)
      setPageMsg({ ok: true, text: `Added ${res.page.company}, ${res.openings} open roles right now.` })
      setUrl('')
    } catch (err) {
      setPageMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Adding failed.' })
    } finally {
      setAdding(false)
    }
  }

  async function removePage(slug: string, provider: string) {
    setProfile(
      await api.patchProfile({
        career_pages: p.career_pages.filter((c) => !(c.slug === slug && c.provider === provider)),
      }),
    )
  }

  const wantsRemote = p.work_modes.includes('remote')
  const keyState = (set: boolean) => (set ? <span className="text-ok">Connected</span> : <span>Not connected</span>)

  return (
    <StepShell
      title="Where should it search?"
      lede="Remote job boards work without any setup. Each free key below adds a larger pool of jobs, especially for on-site roles. You can add them later in Settings."
      onSubmit={async () => setProfile(await api.patchProfile({ sources }))}
    >
      <div className="max-w-2xl">
        <SourceBlock
          name="Remote job boards"
          status={wantsRemote ? <span className="text-ok">Ready, no key needed</span> : 'Used for remote jobs only'}
        >
          <p className="mb-4 text-sm text-graphite">Himalayas, Remotive, RemoteOK and Arbeitnow.</p>
          <Toggle checked={sources.remote_boards} onChange={(v) => on('remote_boards', v)} label="Search remote job boards" />
        </SourceBlock>

        <SourceBlock name="JSearch (Google for Jobs)" status={keyState(keys.RAPIDAPI_KEY?.set)}>
          <KeyForm
            service="rapidapi"
            envKey="RAPIDAPI_KEY"
            fields={[{ name: 'key', label: 'RapidAPI key' }]}
            help={
              <p className="text-sm text-graphite">
                Covers LinkedIn, Indeed, Glassdoor and local boards through Google. Open{' '}
                <ExternalLink href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch">JSearch on RapidAPI</ExternalLink>,
                subscribe to the free Basic plan, then copy the X-RapidAPI-Key value. The free plan allows about 200
                searches a month, so each run uses six.
              </p>
            }
          />
        </SourceBlock>

        <SourceBlock name="Jooble" status={keyState(keys.JOOBLE_API_KEY?.set)}>
          <KeyForm
            service="jooble"
            envKey="JOOBLE_API_KEY"
            fields={[{ name: 'key', label: 'Jooble API key' }]}
            help={
              <p className="text-sm text-graphite">
                Strong in the Middle East, Asia and Eastern Europe. Request a key at{' '}
                <ExternalLink href="https://jooble.org/api/about">jooble.org/api/about</ExternalLink>; it arrives by email.
              </p>
            }
          />
        </SourceBlock>

        <SourceBlock name="Adzuna" status={keyState(keys.ADZUNA_APP_KEY?.set)}>
          <KeyForm
            service="adzuna"
            envKey="ADZUNA_APP_KEY"
            fields={[
              { name: 'app_id', label: 'App ID', type: 'text' },
              { name: 'app_key', label: 'App key' },
            ]}
            help={
              <p className="text-sm text-graphite">
                Large pools in the US, UK, Europe, India and Australia, with exact posting dates. Register at{' '}
                <ExternalLink href="https://developer.adzuna.com/signup">developer.adzuna.com</ExternalLink>.
              </p>
            }
          />
        </SourceBlock>

        <SourceBlock
          name="Company career pages"
          status={p.career_pages.length ? `${p.career_pages.length} added` : 'None yet'}
        >
          <p className="text-sm text-graphite">
            Jobs straight from employers you'd like to work for, often before they reach any board. Paste the link to the
            company's job list if it runs on Greenhouse, Lever, Ashby, Workable, SmartRecruiters or Recruitee.
          </p>
          {p.career_pages.length > 0 && (
            <ul className="mt-4 divide-y divide-rule border-y border-rule">
              {p.career_pages.map((c) => (
                <li key={`${c.provider}-${c.slug}`} className="flex items-center justify-between py-2.5">
                  <span>
                    {c.company} <span className="text-sm text-graphite">on {c.provider}</span>
                  </span>
                  <Button variant="plain" onClick={() => void removePage(c.slug, c.provider)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div
            className="mt-4 flex items-end gap-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (url.trim() && !adding) void addPage()
              }
            }}
          >
            <Field
              label="Careers page link"
              type="url"
              className="flex-1"
              placeholder="https://jobs.lever.co/company"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button variant="quiet" onClick={addPage} busy={adding} disabled={!url.trim()}>
              Add
            </Button>
          </div>
          {pageMsg && (
            <div className="mt-3">
              <Notice tone={pageMsg.ok ? 'ok' : 'error'}>{pageMsg.text}</Notice>
            </div>
          )}
        </SourceBlock>

        <SourceBlock name="LinkedIn" status={sources.linkedin ? 'On' : 'Off'}>
          <p className="mb-4 text-sm text-graphite">
            Reads LinkedIn's public job search without signing in. LinkedIn's terms don't allow automated access and it
            may block your connection for a while, so it's off unless you turn it on. JSearch reaches most of the same
            postings.
          </p>
          <Toggle checked={sources.linkedin} onChange={(v) => on('linkedin', v)} label="Search LinkedIn" />
        </SourceBlock>
      </div>
    </StepShell>
  )
}

export function EmailStep() {
  const { state, setProfile, mode } = useFlow()
  const p = state.profile
  const connected = state.keys.GMAIL_APP_PASSWORD?.set
  const [enabled, setEnabled] = useState(p.digest_enabled)
  const [time, setTime] = useState(p.digest_time)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function sendTest() {
    setTesting(true)
    setTestMsg(null)
    try {
      setTestMsg({ ok: true, text: (await api.testDigest()).message })
    } catch (err) {
      setTestMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Sending failed.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <StepShell
      title="Get the shortlist by email"
      lede="Optional. While Shortlist is running, it searches once a day at the time you pick and emails you what it found, from your own Gmail."
      onSubmit={async () => setProfile(await api.patchProfile({ digest_enabled: enabled && Boolean(connected), digest_time: time }))}
      submitLabel={connected ? 'Continue' : 'Skip email'}
    >
      <div className="max-w-lg space-y-8">
        <KeyForm
          service="gmail"
          envKey="GMAIL_APP_PASSWORD"
          fields={[
            { name: 'address', label: 'Gmail address', type: 'email' },
            { name: 'app_password', label: 'App password', placeholder: '16 letters' },
            { name: 'recipient', label: 'Send to a different address (optional)', type: 'email', optional: true },
          ]}
          help={
            <p className="text-sm text-graphite">
              Gmail needs an app password, not your normal one. Turn on 2-Step Verification, then create one at{' '}
              <ExternalLink href="https://myaccount.google.com/apppasswords">myaccount.google.com/apppasswords</ExternalLink>.
            </p>
          }
        />
        {connected && (
          <div className="space-y-5 border-t border-rule pt-6">
            <Toggle checked={enabled} onChange={setEnabled} label="Search and email me every day" />
            {enabled && (
              <Field label="At" type="time" className="w-36" value={time} onChange={(e) => setTime(e.target.value)} />
            )}
            {mode === 'settings' && (
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="quiet" onClick={sendTest} busy={testing}>
                  Send a test email
                </Button>
                {testMsg && <Notice tone={testMsg.ok ? 'ok' : 'error'}>{testMsg.text}</Notice>}
              </div>
            )}
          </div>
        )}
      </div>
    </StepShell>
  )
}

export function ReviewStep({ goTo, onFinish }: { goTo: (id: string) => void; onFinish: () => Promise<void> }) {
  const { state, reference } = useFlow()
  const p = state.profile
  const nameOf = (code: string) => reference?.countries.find((c) => c.code === code)?.name ?? code
  const sourceCount =
    (p.work_modes.includes('remote') && p.sources.remote_boards ? 4 : 0) +
    (state.keys.RAPIDAPI_KEY?.set ? 1 : 0) +
    (state.keys.JOOBLE_API_KEY?.set ? 1 : 0) +
    (state.keys.ADZUNA_APP_KEY?.set ? 1 : 0) +
    (p.sources.linkedin ? 1 : 0) +
    p.career_pages.length

  const rows: { label: string; value: ReactNode; step: string }[] = [
    { label: 'Looking for', value: p.titles.join(', '), step: 'titles' },
    { label: 'Skills', value: `${p.skills.length} from your resume`, step: 'resume' },
    { label: 'Work', value: p.work_modes.join(', '), step: 'work' },
    {
      label: 'Countries',
      value: p.target_countries.length ? p.target_countries.map(nameOf).join(', ') : 'Anywhere',
      step: 'places',
    },
    { label: 'Visa', value: p.needs_visa ? 'Needs sponsorship' : 'No sponsorship needed', step: 'visa' },
    { label: 'Experience asked', value: `Up to ${p.max_years_required ?? 'any'} years`, step: 'experience' },
    {
      label: 'Salary',
      value: p.salary.minimum ? `${p.salary.minimum.toLocaleString()} ${p.salary.currency} a ${p.salary.period}` : 'Not set',
      step: 'salary',
    },
    { label: 'Posted within', value: `${p.max_age_days} days`, step: 'freshness' },
    { label: 'Sources', value: sourceCount ? `${sourceCount} sources` : 'None yet', step: 'sources' },
    { label: 'Email', value: p.digest_enabled ? `Daily at ${p.digest_time}` : 'Off', step: 'email' },
  ]

  return (
    <StepShell
      title="Ready for your first search"
      lede={
        sourceCount === 0
          ? 'No sources are set up yet. Allow remote work or add a key under Sources, or the search will find nothing.'
          : 'It takes a few minutes. You can watch it work, and the list fills in as jobs are read.'
      }
      submitLabel="Run my first search"
      canSubmit={sourceCount > 0}
      onSubmit={onFinish}
    >
      <dl className="max-w-2xl border-t border-rule">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[9rem_1fr_auto] items-baseline gap-4 border-b border-rule py-3.5 max-sm:grid-cols-[1fr_auto]">
            <dt className="text-sm text-graphite max-sm:col-span-2">{r.label}</dt>
            <dd className="text-[0.95rem]">{r.value}</dd>
            <dd>
              <button
                type="button"
                onClick={() => goTo(r.step)}
                className="text-sm text-graphite underline decoration-rule underline-offset-4 hover:text-ink"
              >
                Edit<span className="sr-only"> {r.label}</span>
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </StepShell>
  )
}
