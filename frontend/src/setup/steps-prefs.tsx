import {
  Ban,
  Building2,
  CalendarDays,
  Globe,
  House,
  Laptop,
  MapPin,
  Plane,
  Search,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { api, type WorkMode } from '../api'
import { TagInput } from '../ui/TagInput'
import { Chip, Field, IconTile, Toggle, selectClass } from '../ui/ui'
import { useFlow } from './flow'
import { StepShell } from './StepShell'

/** A large selectable card, used for single and multiple choice questions. */
function OptionCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  multi = false,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: ReactNode
  icon?: LucideIcon
  multi?: boolean
}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 ${
        selected
          ? 'border-brand bg-brand-soft/60 shadow-[0_0_0_3px] shadow-brand/15'
          : 'border-line bg-surface shadow-card hover:border-line-strong'
      }`}
    >
      {icon && <IconTile icon={icon} tone={selected ? 'brand' : 'neutral'} />}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{description}</span>
      </span>
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center border-2 transition-colors duration-150 ${
          multi ? 'rounded-md' : 'rounded-full'
        } ${selected ? 'border-brand bg-brand' : 'border-line-strong bg-surface'}`}
      >
        {selected &&
          (multi ? (
            <svg viewBox="0 0 24 24" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <span className="size-2 rounded-full bg-white" />
          ))}
      </span>
    </button>
  )
}

const MODES: { value: WorkMode; title: string; description: string; icon: LucideIcon }[] = [
  { value: 'remote', title: 'Remote', description: 'Work from home. Worldwide remote roles need no visa.', icon: Laptop },
  { value: 'hybrid', title: 'Hybrid', description: 'Some days in an office, so you live near it.', icon: House },
  { value: 'onsite', title: 'On-site', description: 'In the office every day.', icon: Building2 },
]

export function WorkModeStep() {
  const { state, setProfile } = useFlow()
  const [modes, setModes] = useState<WorkMode[]>(state.profile.work_modes)
  const toggle = (m: WorkMode) => setModes((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))
  return (
    <StepShell
      title="How do you want to work?"
      lede="Choose every arrangement you'd accept."
      canSubmit={modes.length > 0}
      onSubmit={async () => setProfile(await api.patchProfile({ work_modes: modes }))}
    >
      <div className="grid max-w-xl grid-cols-1 gap-3" role="group" aria-label="Work arrangements">
        {MODES.map((m) => (
          <OptionCard
            key={m.value}
            multi
            icon={m.icon}
            selected={modes.includes(m.value)}
            onSelect={() => toggle(m.value)}
            title={m.title}
            description={m.description}
          />
        ))}
      </div>
    </StepShell>
  )
}

export function PlacesStep() {
  const { state, reference, setProfile } = useFlow()
  const p = state.profile
  const [home, setHome] = useState(p.home_country)
  const [targets, setTargets] = useState<string[]>(p.target_countries)
  const [cities, setCities] = useState<string[]>(p.cities)
  const [query, setQuery] = useState('')
  const remoteOnly = p.work_modes.length === 1 && p.work_modes[0] === 'remote'

  const countries = useMemo(() => reference?.countries ?? [], [reference])
  const nameOf = (code: string) => countries.find((c) => c.code === code)?.name ?? code
  const matches = query.trim()
    ? countries.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []

  const toggle = (code: string) =>
    setTargets((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]))

  function toggleGroup(codes: string[]) {
    const all = codes.every((c) => targets.includes(c))
    setTargets((cur) => (all ? cur.filter((c) => !codes.includes(c)) : [...new Set([...cur, ...codes])]))
  }

  return (
    <StepShell
      title="Where do you want to work?"
      lede={
        remoteOnly
          ? 'You only want remote work, so countries are optional. Add some if you prefer employers based there.'
          : "Jobs in the countries you pick rank first. On-site jobs anywhere else are left out, unless they're remote."
      }
      canSubmit={Boolean(home)}
      onSubmit={async () => setProfile(await api.patchProfile({ home_country: home, target_countries: targets, cities }))}
    >
      <div className="max-w-2xl space-y-8">
        <div className="max-w-sm">
          <label htmlFor="home-country" className="mb-1.5 block text-sm font-medium">
            The country you live in now
          </label>
          <div className="relative">
            <House aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
            <select id="home-country" value={home} onChange={(e) => setHome(e.target.value)} className={`${selectClass} pl-10`}>
              <option value="">Choose a country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-subtle/50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Globe aria-hidden className="size-4 text-brand" />
            Countries you'd work in
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(reference?.groups ?? {}).map(([group, codes]) => (
              <Chip key={group} selected={codes.every((c) => targets.includes(c))} onToggle={() => toggleGroup(codes)}>
                {group}
              </Chip>
            ))}
          </div>

          <div className="relative mt-5 max-w-sm">
            <Field
              label="Find a country"
              placeholder="Start typing"
              icon={Search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (matches[0]) {
                    toggle(matches[0].code)
                    setQuery('')
                  }
                }
              }}
            />
            {matches.length > 0 && (
              <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
                {matches.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => {
                        toggle(c.code)
                        setQuery('')
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[0.9375rem] hover:bg-subtle"
                    >
                      {c.name}
                      {targets.includes(c.code) && <span className="text-xs font-medium text-brand">Selected</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {targets.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Selected countries">
              {targets.map((code) => (
                <li key={code}>
                  <Chip selected removable label={`Remove ${nameOf(code)}`} onToggle={() => toggle(code)}>
                    {nameOf(code)}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </div>

        <TagInput
          label="Cities (optional)"
          values={cities}
          onChange={setCities}
          placeholder="e.g. Dubai"
          hint="Jobs in these cities also rank first, even in a country you didn't pick."
          max={20}
        />
      </div>
    </StepShell>
  )
}

export function VisaStep() {
  const { state, reference, setProfile } = useFlow()
  const p = state.profile
  const home = reference?.countries.find((c) => c.code === p.home_country)?.name ?? 'your country'
  const [needsVisa, setNeedsVisa] = useState(p.needs_visa)
  const [relocate, setRelocate] = useState(p.willing_to_relocate)
  return (
    <StepShell
      title={`Do you need a visa to work outside ${home}?`}
      lede="The AI checks each posting for sponsorship. A job that can't sponsor you ranks lower instead of costing you an application."
      onSubmit={async () => setProfile(await api.patchProfile({ needs_visa: needsVisa, willing_to_relocate: relocate }))}
    >
      <div className="max-w-xl">
        <div role="radiogroup" aria-label="Visa sponsorship" className="grid gap-3">
          <OptionCard
            icon={Plane}
            selected={needsVisa}
            onSelect={() => setNeedsVisa(true)}
            title="Yes, I'd need sponsorship"
            description="Prefer employers that sponsor, and remote roles open worldwide."
          />
          <OptionCard
            icon={ShieldCheck}
            selected={!needsVisa}
            onSelect={() => setNeedsVisa(false)}
            title="No, I can already work in my target countries"
            description="A citizenship, residence permit or existing visa covers it."
          />
        </div>
        <div className="mt-6 rounded-2xl border border-line p-4">
          <Toggle checked={relocate} onChange={setRelocate} label="I'm willing to relocate for the right job" />
        </div>
      </div>
    </StepShell>
  )
}

export function ExperienceStep() {
  const { state, setProfile } = useFlow()
  const p = state.profile
  const [cap, setCap] = useState(p.max_years_required ?? Math.round((p.years_experience ?? 2) + 4))
  const yours = p.years_experience
  const pct = ((cap - 1) / 24) * 100
  return (
    <StepShell
      title="How much of a stretch is fine?"
      lede={
        <>
          Postings often ask for more experience than they hire at.
          {yours !== null && ` You have about ${yours} years.`} Jobs asking for more than this are skipped before the AI reads them.
        </>
      }
      onSubmit={async () => setProfile(await api.patchProfile({ max_years_required: cap }))}
    >
      <div className="max-w-lg rounded-2xl border border-line bg-subtle/50 p-6">
        <label htmlFor="years-cap" className="block text-sm font-medium text-muted">
          Skip jobs that ask for more than
        </label>
        <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums" aria-live="polite">
          {cap} <span className="text-xl font-medium text-muted">years</span>
        </p>
        <input
          id="years-cap"
          type="range"
          min={1}
          max={25}
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="mt-6 h-2 w-full cursor-pointer appearance-none rounded-full accent-(--color-brand)"
          style={{ background: `linear-gradient(90deg, var(--color-brand) ${pct}%, var(--color-line) ${pct}%)` }}
        />
        <div className="mt-2 flex justify-between text-xs text-faint">
          <span>1 year</span>
          <span>25 years</span>
        </div>
      </div>
    </StepShell>
  )
}

function matchTone(pct: number): string {
  return pct >= 70 ? 'var(--color-success)' : pct >= 55 ? 'var(--color-brand)' : 'var(--color-warning)'
}

export function MatchStep() {
  const { state, setProfile } = useFlow()
  const [min, setMin] = useState(state.profile.min_match_score)
  const pct = ((min - 40) / 50) * 100
  return (
    <StepShell
      title="How close of a match do you want?"
      lede="The AI scores every posting from 0 to 100 against your resume, titles and experience. Jobs scoring below this are filed away instead of shown. Lower it to see more possibilities, raise it to see only your strongest matches."
      onSubmit={async () => setProfile(await api.patchProfile({ min_match_score: min }))}
    >
      <div className="max-w-lg rounded-2xl border border-line bg-subtle/50 p-6">
        <label htmlFor="min-match" className="block text-sm font-medium text-muted">
          Only show jobs that match at least
        </label>
        <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums" aria-live="polite" style={{ color: matchTone(min) }}>
          {min}<span className="text-xl font-medium text-muted">%</span>
        </p>
        <input
          id="min-match"
          type="range"
          min={40}
          max={90}
          step={5}
          value={min}
          onChange={(e) => setMin(Number(e.target.value))}
          className="mt-6 h-2 w-full cursor-pointer appearance-none rounded-full accent-(--color-brand)"
          style={{ background: `linear-gradient(90deg, var(--color-brand) ${pct}%, var(--color-line) ${pct}%)` }}
        />
        <div className="mt-2 flex justify-between text-xs text-faint">
          <span>40%, cast a wide net</span>
          <span>90%, only near-perfect fits</span>
        </div>
      </div>
    </StepShell>
  )
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'PKR', 'INR', 'CAD', 'AUD', 'SGD', 'CHF', 'PLN']

export function SalaryStep() {
  const { state, setProfile, next } = useFlow()
  const s = state.profile.salary
  const [minimum, setMinimum] = useState(s.minimum?.toString() ?? '')
  const [currency, setCurrency] = useState(s.currency)
  const [period, setPeriod] = useState(s.period)
  const [strict, setStrict] = useState(s.strict)

  const parsed = minimum.trim() === '' ? null : Number(minimum.replace(/[,\s]/g, ''))
  const minimumError = parsed !== null && (Number.isNaN(parsed) || parsed < 0) ? 'Enter a number, like 3500.' : ''

  async function save(clear = false) {
    const value = clear ? null : parsed
    setProfile(await api.patchProfile({ salary: { minimum: value, currency, period, strict } }))
  }

  return (
    <StepShell
      title="What's the least you'd accept?"
      lede="Most postings don't list a salary, so this only affects the ones that do. Amounts are compared in the same currency."
      onSubmit={() => save()}
      canSubmit={!minimumError}
      skipLabel="Skip this"
      onSkip={async () => {
        await save(true)
        next()
      }}
    >
      <div className="max-w-xl space-y-6">
        <div className="flex flex-wrap items-start gap-3">
          <Field
            label="Minimum salary"
            inputMode="numeric"
            placeholder="e.g. 3500"
            icon={Wallet}
            className="w-48"
            error={minimumError}
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
          />
          <div>
            <label htmlFor="currency" className="mb-1.5 block text-sm font-medium">
              Currency
            </label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${selectClass} w-28`}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="sm:pt-7">
            <div role="radiogroup" aria-label="Pay period" className="inline-flex rounded-[10px] bg-subtle p-1">
              {(['month', 'year'] as const).map((per) => (
                <button
                  key={per}
                  type="button"
                  role="radio"
                  aria-checked={period === per}
                  onClick={() => setPeriod(per)}
                  className={`h-9 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 ${
                    period === per ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
                  }`}
                >
                  per {per}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-line p-4">
          <Toggle
            checked={strict}
            onChange={setStrict}
            label="Hide jobs that pay less"
            description="When off, they stay in your list with a note that the pay is below your minimum."
          />
        </div>
      </div>
    </StepShell>
  )
}

export function ExclusionsStep() {
  const { state, setProfile } = useFlow()
  const p = state.profile
  const [words, setWords] = useState(p.exclude_title_words)
  const [dealbreakers, setDealbreakers] = useState(p.dealbreakers)
  return (
    <StepShell
      title="Anything to rule out?"
      lede="Titles with these words are skipped without spending AI time. Filled in from your experience level; change them freely."
      onSubmit={async () => setProfile(await api.patchProfile({ exclude_title_words: words, dealbreakers }))}
    >
      <div className="max-w-2xl space-y-8">
        <TagInput
          label="Skip titles containing"
          values={words}
          onChange={setWords}
          placeholder="e.g. manager"
          hint="Whole words only, so intern won't block internal."
        />
        <div>
          <label htmlFor="dealbreakers" className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <Ban aria-hidden className="size-4 text-faint" />
            Dealbreakers (optional)
          </label>
          <textarea
            id="dealbreakers"
            rows={3}
            maxLength={500}
            value={dealbreakers}
            onChange={(e) => setDealbreakers(e.target.value)}
            placeholder="e.g. No night shifts. No gambling or crypto companies. No roles that are mostly manual testing."
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base leading-relaxed shadow-card transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none sm:text-[0.9375rem]"
          />
          <p className="mt-1.5 text-sm text-muted">The AI reads these and scores matching jobs low.</p>
        </div>
      </div>
    </StepShell>
  )
}

export function FreshnessStep() {
  const { state, setProfile } = useFlow()
  const [days, setDays] = useState(state.profile.max_age_days)
  const [budget, setBudget] = useState(state.profile.max_jobs_to_score)
  return (
    <StepShell
      title="How recent should postings be?"
      lede="Older postings are often filled already. Postings without a date are always kept."
      onSubmit={async () => setProfile(await api.patchProfile({ max_age_days: days, max_jobs_to_score: budget }))}
    >
      <div className="max-w-xl space-y-8">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <CalendarDays aria-hidden className="size-4 text-brand" />
            Posted within
          </h2>
          <div role="radiogroup" aria-label="Posted within" className="flex flex-wrap gap-2">
            {[7, 14, 21, 30].map((d) => (
              <Chip key={d} selected={days === d} onToggle={() => setDays(d)}>
                Last {d} days
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MapPin aria-hidden className="size-4 text-brand" />
            Jobs the AI reads per search
          </h2>
          <div role="radiogroup" aria-label="Jobs read per search" className="grid gap-3">
            {[
              { n: 30, title: '30 jobs', description: 'About two minutes. Easy on the free Groq limit.' },
              { n: 60, title: '60 jobs', description: 'About four minutes. A good daily default.' },
              { n: 120, title: '120 jobs', description: 'About ten minutes. Add a backup AI key for this.' },
            ].map((o) => (
              <OptionCard key={o.n} selected={budget === o.n} onSelect={() => setBudget(o.n)} title={o.title} description={o.description} />
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  )
}
