import {
  Building2,
  ChevronDown,
  Globe,
  Link,
  Mail,
  Pencil,
  Radar,
  Rocket,
  Search,
  Send,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { api, ApiError, type Profile } from '../api'
import { Badge, Button, ExternalLink, Field, IconTile, Notice, Toggle } from '../ui/ui'
import { useFlow } from './flow'
import { KeyForm } from './KeyForm'
import { StepShell } from './StepShell'

function SourceCard({
  name,
  description,
  icon,
  status,
  children,
}: {
  name: string
  description: string
  icon: LucideIcon
  status: ReactNode
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 p-4 sm:gap-4">
        <IconTile icon={icon} tone="neutral" />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{name}</h3>
          <p className="truncate text-sm text-muted">{description}</p>
        </div>
        <div className="hidden sm:block">{status}</div>
        {children && (
          <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Close' : 'Set up'}
            <ChevronDown aria-hidden className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && children && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line p-5">
              <div className="mb-4 sm:hidden">{status}</div>
              <div className="max-w-lg">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const keyState = (set: boolean) =>
    set ? <Badge tone="success">Connected</Badge> : <Badge>Not connected</Badge>

  return (
    <StepShell
      title="Where should it search?"
      lede="Remote job boards work without any setup. Each free key below adds a larger pool of jobs, especially for on-site roles. You can add them later in Settings."
      onSubmit={async () => setProfile(await api.patchProfile({ sources }))}
    >
      <div className="grid max-w-2xl grid-cols-1 gap-3">
        <SourceCard
          name="Remote job boards"
          description="Himalayas, Remotive, RemoteOK and Arbeitnow"
          icon={Globe}
          status={wantsRemote ? <Badge tone="success">Ready</Badge> : <Badge>Remote only</Badge>}
        >
          <Toggle checked={sources.remote_boards} onChange={(v) => on('remote_boards', v)} label="Search remote job boards" />
        </SourceCard>

        <SourceCard name="JSearch" description="Google for Jobs: LinkedIn, Indeed, Glassdoor" icon={Search} status={keyState(keys.RAPIDAPI_KEY?.set)}>
          <KeyForm
            service="rapidapi"
            envKey="RAPIDAPI_KEY"
            fields={[{ name: 'key', label: 'RapidAPI key' }]}
            help={
              <p className="text-sm text-muted">
                Open <ExternalLink href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch">JSearch on RapidAPI</ExternalLink>,
                subscribe to the free Basic plan, then copy the X-RapidAPI-Key value. About 200 searches a month; each run uses six.
              </p>
            }
          />
        </SourceCard>

        <SourceCard name="Jooble" description="Strong in the Middle East, Asia, Eastern Europe" icon={Radar} status={keyState(keys.JOOBLE_API_KEY?.set)}>
          <KeyForm
            service="jooble"
            envKey="JOOBLE_API_KEY"
            fields={[{ name: 'key', label: 'Jooble API key' }]}
            help={
              <p className="text-sm text-muted">
                Request a key at <ExternalLink href="https://jooble.org/api/about">jooble.org/api/about</ExternalLink>; it arrives by email.
              </p>
            }
          />
        </SourceCard>

        <SourceCard name="Adzuna" description="US, UK, Europe, India, Australia" icon={Radar} status={keyState(keys.ADZUNA_APP_KEY?.set)}>
          <KeyForm
            service="adzuna"
            envKey="ADZUNA_APP_KEY"
            fields={[
              { name: 'app_id', label: 'App ID', type: 'text' },
              { name: 'app_key', label: 'App key' },
            ]}
            help={
              <p className="text-sm text-muted">
                Register at <ExternalLink href="https://developer.adzuna.com/signup">developer.adzuna.com</ExternalLink>.
              </p>
            }
          />
        </SourceCard>

        <SourceCard
          name="Company career pages"
          description="Straight from employers you'd like to work for"
          icon={Building2}
          status={p.career_pages.length ? <Badge tone="brand">{p.career_pages.length} added</Badge> : <Badge>None yet</Badge>}
        >
          <p className="text-sm text-muted">
            Paste the link to a company's job list if it runs on Greenhouse, Lever, Ashby, Workable, SmartRecruiters or Recruitee.
          </p>
          {p.career_pages.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {p.career_pages.map((c) => (
                <li key={`${c.provider}-${c.slug}`} className="flex items-center justify-between gap-3 px-3.5 py-2">
                  <span className="text-sm">
                    <span className="font-medium">{c.company}</span> <span className="text-muted">on {c.provider}</span>
                  </span>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => void removePage(c.slug, c.provider)}>
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
              icon={Link}
              className="flex-1"
              placeholder="https://jobs.lever.co/company"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button variant="secondary" onClick={addPage} busy={adding} disabled={!url.trim()}>
              Add
            </Button>
          </div>
          {pageMsg && (
            <div className="mt-3">
              <Notice tone={pageMsg.ok ? 'ok' : 'error'}>{pageMsg.text}</Notice>
            </div>
          )}
        </SourceCard>

        <SourceCard
          name="LinkedIn"
          description="Public job search, off by default"
          icon={Globe}
          status={sources.linkedin ? <Badge tone="warning">On</Badge> : <Badge>Off</Badge>}
        >
          <p className="mb-4 text-sm text-muted">
            Reads LinkedIn's public job search without signing in. LinkedIn's terms don't allow automated access and it may block
            your connection for a while. JSearch reaches most of the same postings.
          </p>
          <Toggle checked={sources.linkedin} onChange={(v) => on('linkedin', v)} label="Search LinkedIn" />
        </SourceCard>
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
      eyebrow={<Badge icon={Mail}>Optional</Badge>}
      title="Get the shortlist by email"
      lede="While Shortlist is running, it searches once a day at the time you pick and emails you what it found, from your own Gmail."
      onSubmit={async () => setProfile(await api.patchProfile({ digest_enabled: enabled && Boolean(connected), digest_time: time }))}
      submitLabel={connected ? 'Continue' : 'Skip email'}
    >
      <div className="max-w-lg space-y-6">
        <KeyForm
          service="gmail"
          envKey="GMAIL_APP_PASSWORD"
          fields={[
            { name: 'address', label: 'Gmail address', type: 'email' },
            { name: 'app_password', label: 'App password', placeholder: '16 letters' },
            { name: 'recipient', label: 'Send to a different address (optional)', type: 'email', optional: true },
          ]}
          help={
            <p className="text-sm text-muted">
              Gmail needs an app password, not your normal one. Turn on 2-Step Verification, then create one at{' '}
              <ExternalLink href="https://myaccount.google.com/apppasswords">myaccount.google.com/apppasswords</ExternalLink>.
            </p>
          }
        />
        {connected && (
          <div className="space-y-5 rounded-2xl border border-line p-5">
            <Toggle checked={enabled} onChange={setEnabled} label="Search and email me every day" />
            {enabled && <Field label="At" type="time" className="w-40" value={time} onChange={(e) => setTime(e.target.value)} />}
            {mode === 'settings' && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" icon={Send} onClick={sendTest} busy={testing}>
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
    { label: 'Countries', value: p.target_countries.length ? p.target_countries.map(nameOf).join(', ') : 'Anywhere', step: 'places' },
    { label: 'Visa', value: p.needs_visa ? 'Needs sponsorship' : 'No sponsorship needed', step: 'visa' },
    { label: 'Experience asked', value: `Up to ${p.max_years_required ?? 'any'} years`, step: 'experience' },
    { label: 'Match threshold', value: `${p.min_match_score}% or higher`, step: 'match' },
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
      eyebrow={<Badge tone="success" icon={Rocket}>Almost there</Badge>}
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
      <dl className="max-w-2xl divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-subtle/60 sm:px-5">
            <dt className="w-32 shrink-0 text-sm text-muted sm:w-40">{r.label}</dt>
            <dd className="min-w-0 flex-1 text-[0.9375rem] font-medium">{r.value}</dd>
            <dd>
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => goTo(r.step)} aria-label={`Edit ${r.label}`}>
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </dd>
          </div>
        ))}
      </dl>
    </StepShell>
  )
}
