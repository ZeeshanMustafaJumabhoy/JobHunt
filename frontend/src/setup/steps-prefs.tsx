import { useMemo, useState, type ReactNode } from 'react'
import { api, type WorkMode } from '../api'
import { TagInput } from '../ui/TagInput'
import { Chip, Field, Toggle } from '../ui/ui'
import { useFlow } from './flow'
import { StepShell } from './StepShell'

function OptionRow({
  selected,
  onSelect,
  title,
  description,
  multi = false,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: ReactNode
  multi?: boolean
}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-start gap-4 border-b border-rule py-4 text-left transition-colors duration-150 first:border-t hover:bg-sheet ${
        selected ? '' : 'text-graphite'
      }`}
    >
      <span
        aria-hidden
        className={`mt-1 grid size-4.5 shrink-0 place-items-center border transition-colors duration-150 ${
          multi ? 'rounded-[4px]' : 'rounded-full'
        } ${selected ? 'border-ink bg-ink' : 'border-faint'}`}
      >
        {selected && <span className={`bg-paper ${multi ? 'h-2 w-2 rounded-[1px]' : 'size-1.5 rounded-full'}`} />}
      </span>
      <span>
        <span className={`block text-[1.05rem] ${selected ? 'font-medium text-ink' : ''}`}>{title}</span>
        <span className="mt-0.5 block text-sm text-graphite">{description}</span>
      </span>
    </button>
  )
}

const MODES: { value: WorkMode; title: string; description: string }[] = [
  { value: 'remote', title: 'Remote', description: 'Work from home. Worldwide remote roles need no visa.' },
  { value: 'hybrid', title: 'Hybrid', description: 'Some days in an office, so you live near it.' },
  { value: 'onsite', title: 'On-site', description: 'In the office every day.' },
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
      <div className="max-w-xl" role="group" aria-label="Work arrangements">
        {MODES.map((m) => (
          <OptionRow
            key={m.value}
            multi
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
      onSubmit={async () =>
        setProfile(await api.patchProfile({ home_country: home, target_countries: targets, cities }))
      }
    >
      <div className="max-w-2xl space-y-10">
        <div className="max-w-sm">
          <label htmlFor="home-country" className="mb-1.5 block text-sm font-medium">
            The country you live in now
          </label>
          <select
            id="home-country"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="h-11 w-full rounded-md border border-rule bg-sheet px-3 text-[0.95rem] focus:border-pen focus:outline-none"
          >
            <option value="">Choose a country</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h2 className="text-sm font-medium">Countries you'd work in</h2>
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
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-rule bg-sheet shadow-[0_8px_24px_-12px_rgb(27_36_48/0.35)]">
                {matches.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => {
                        toggle(c.code)
                        setQuery('')
                      }}
                      className="flex w-full justify-between px-3 py-2.5 text-left text-[0.95rem] hover:bg-paper"
                    >
                      {c.name}
                      {targets.includes(c.code) && <span className="text-sm text-graphite">Selected</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {targets.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Selected countries">
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
      lede="The AI checks each posting for sponsorship, and a job that can't sponsor you ranks lower instead of wasting an application."
      onSubmit={async () => setProfile(await api.patchProfile({ needs_visa: needsVisa, willing_to_relocate: relocate }))}
    >
      <div className="max-w-xl">
        <div role="radiogroup" aria-label="Visa sponsorship">
          <OptionRow
            selected={needsVisa}
            onSelect={() => setNeedsVisa(true)}
            title="Yes, I'd need sponsorship"
            description="Prefer employers that sponsor, and remote roles open worldwide."
          />
          <OptionRow
            selected={!needsVisa}
            onSelect={() => setNeedsVisa(false)}
            title="No, I can already work in my target countries"
            description="A citizenship, residence permit or existing visa covers it."
          />
        </div>
        <div className="mt-8">
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
  return (
    <StepShell
      title="How much of a stretch is fine?"
      lede={
        <>
          Postings often ask for more experience than they hire at.
          {yours !== null && ` You have about ${yours} years.`} Jobs asking for more than this are skipped before the AI
          reads them.
        </>
      }
      onSubmit={async () => setProfile(await api.patchProfile({ max_years_required: cap }))}
    >
      <div className="max-w-md">
        <label htmlFor="years-cap" className="block text-sm font-medium">
          Skip jobs that ask for more than
        </label>
        <p className="mt-3 text-display font-semibold tabular-nums" aria-live="polite">
          {cap} <span className="text-title font-normal text-graphite">years</span>
        </p>
        <input
          id="years-cap"
          type="range"
          min={1}
          max={25}
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="mt-4 w-full accent-(--color-pen)"
        />
        <div className="mt-1 flex justify-between text-sm text-faint">
          <span>1</span>
          <span>25</span>
        </div>
      </div>
    </StepShell>
  )
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'PKR', 'INR', 'CAD', 'AUD', 'SGD', 'CHF', 'PLN']

export function SalaryStep() {
  const { state, setProfile } = useFlow()
  const s = state.profile.salary
  const [minimum, setMinimum] = useState(s.minimum?.toString() ?? '')
  const [currency, setCurrency] = useState(s.currency)
  const [period, setPeriod] = useState(s.period)
  const [strict, setStrict] = useState(s.strict)

  async function save(clear = false) {
    const value = clear || minimum.trim() === '' ? null : Number(minimum.replace(/[,\s]/g, ''))
    if (value !== null && (Number.isNaN(value) || value < 0)) throw new Error('Enter the salary as a number, like 3500.')
    setProfile(await api.patchProfile({ salary: { minimum: value, currency, period, strict } }))
  }

  const { next } = useFlow()
  return (
    <StepShell
      title="What's the least you'd accept?"
      lede="Most postings don't list a salary, so this only affects the ones that do. Amounts are compared in the same currency only."
      onSubmit={() => save()}
      skipLabel="Skip this"
      onSkip={async () => {
        await save(true)
        next()
      }}
    >
      <div className="max-w-xl space-y-8">
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label="Minimum salary"
            inputMode="numeric"
            placeholder="e.g. 3500"
            className="w-44"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
          />
          <div>
            <label htmlFor="currency" className="mb-1.5 block text-sm font-medium">
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-11 rounded-md border border-rule bg-sheet px-3 focus:border-pen focus:outline-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pb-1" role="radiogroup" aria-label="Pay period">
            <Chip selected={period === 'month'} onToggle={() => setPeriod('month')}>
              per month
            </Chip>
            <Chip selected={period === 'year'} onToggle={() => setPeriod('year')}>
              per year
            </Chip>
          </div>
        </div>
        <Toggle
          checked={strict}
          onChange={setStrict}
          label="Hide jobs that pay less"
          description="When off, they stay in your list with a note that the pay is below your minimum."
        />
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
      <div className="max-w-2xl space-y-10">
        <TagInput
          label="Skip titles containing"
          values={words}
          onChange={setWords}
          placeholder="e.g. manager"
          hint="Whole words only, so intern won't block internal."
        />
        <div>
          <label htmlFor="dealbreakers" className="mb-1.5 block text-sm font-medium">
            Dealbreakers (optional)
          </label>
          <textarea
            id="dealbreakers"
            rows={3}
            maxLength={500}
            value={dealbreakers}
            onChange={(e) => setDealbreakers(e.target.value)}
            placeholder="e.g. No night shifts. No gambling or crypto companies. No roles that are mostly manual testing."
            className="w-full rounded-md border border-rule bg-sheet px-3 py-2.5 text-[0.95rem] leading-relaxed placeholder:text-faint focus:border-pen focus:outline-none"
          />
          <p className="mt-1.5 text-sm text-graphite">The AI reads these and scores matching jobs low.</p>
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
      <div className="max-w-xl space-y-10">
        <div role="radiogroup" aria-label="Posted within" className="flex flex-wrap gap-2">
          {[7, 14, 21, 30].map((d) => (
            <Chip key={d} selected={days === d} onToggle={() => setDays(d)}>
              Last {d} days
            </Chip>
          ))}
        </div>
        <div>
          <h2 className="text-sm font-medium">Jobs the AI reads per search</h2>
          <div role="radiogroup" aria-label="Jobs read per search" className="mt-2">
            {[
              { n: 30, title: '30', description: 'About two minutes. Easy on the free Groq limit.' },
              { n: 60, title: '60', description: 'About four minutes. A good daily default.' },
              { n: 120, title: '120', description: 'About ten minutes. Add a backup AI key for this.' },
            ].map((o) => (
              <OptionRow
                key={o.n}
                selected={budget === o.n}
                onSelect={() => setBudget(o.n)}
                title={o.title}
                description={o.description}
              />
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  )
}
