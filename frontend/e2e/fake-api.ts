import type { Page, Route } from '@playwright/test'
import type { AppState, Job, Profile, RunState } from '../src/api'

/**
 * An in-memory stand-in for the Python backend, so browser tests exercise the
 * real UI without real API keys, network calls or AI costs.
 */

const KEY_NAMES: Record<string, string[]> = {
  groq: ['GROQ_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  adzuna: ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY'],
  jooble: ['JOOBLE_API_KEY'],
  rapidapi: ['RAPIDAPI_KEY'],
  gmail: ['GMAIL_ADDRESS', 'GMAIL_APP_PASSWORD'],
}

export function blankProfile(): Profile {
  return {
    name: '', headline: '', summary: '', has_resume: false, skills: [], years_experience: null, seniority: '',
    suggested_titles: [], titles: [], title_keywords: [], work_modes: ['remote', 'hybrid', 'onsite'],
    home_country: '', target_countries: [], cities: [], needs_visa: true, willing_to_relocate: true,
    max_years_required: null, salary: { minimum: null, currency: 'USD', period: 'month', strict: false },
    exclude_title_words: [], dealbreakers: '', max_age_days: 21,
    sources: { remote_boards: true, career_pages: true, adzuna: true, jooble: true, jsearch: true, linkedin: false },
    career_pages: [], max_jobs_to_score: 60, digest_enabled: false, digest_time: '09:00',
    setup_step: '', setup_complete: false,
  }
}

const idleRun: RunState = {
  running: false, run_id: null, phase: 'idle', message: '', sources_done: 0, sources_total: 0,
  found: 0, to_score: 0, scored: 0, matches: 0, log: [],
}

export const sampleJobs: Job[] = [
  job('1', 'QA Automation Engineer', 'Tamara', 'Riyadh, Saudi Arabia', 91, 'apply', {
    bucket: 0, bucket_label: 'In your target countries', visa_sponsorship: 'yes', remote_type: 'onsite', direct: true,
    reason: 'Playwright and Python at the core, two to four years asked, and they sponsor visas.',
    matched_skills: ['Playwright', 'Python', 'GitHub Actions'], missing_skills: ['k6'], years_required: 3,
    salary: { salary_min: 18000, salary_max: 24000, salary_currency: 'SAR', salary_period: 'month' },
  }),
  job('2', 'Senior SDET, Payments', 'Ziina', 'Dubai, United Arab Emirates', 84, 'apply', {
    bucket: 0, bucket_label: 'In your target countries', visa_sponsorship: 'unclear', remote_type: 'hybrid',
    reason: 'Strong stack overlap; senior title but asks for four years, which is within reach.',
    matched_skills: ['Playwright', 'TypeScript', 'API Testing'], missing_skills: ['Kotlin'], years_required: 4,
  }),
  job('3', 'Software Engineer in Test', 'Himalayas Labs', 'Remote, worldwide', 76, 'strong', {
    bucket: 1, bucket_label: 'Remote, worldwide', remote_type: 'remote_worldwide', source: 'Himalayas',
    reason: 'Remote contract open to any country; Cypress-heavy, which you would need to pick up.',
    matched_skills: ['JavaScript', 'CI/CD'], missing_skills: ['Cypress'],
  }),
  job('4', 'Test Automation Engineer', 'Devsinc', 'Lahore, Pakistan', 58, 'maybe', {
    bucket: 2, bucket_label: 'In Pakistan', remote_type: 'onsite', source: 'LinkedIn',
    reason: 'Good local fallback, but mostly Selenium with Java and a lower-paying band.',
    matched_skills: ['Selenium', 'Java'], missing_skills: [], salary_below_minimum: true,
  }),
]

function job(id: string, title: string, company: string, location: string, score: number, tier: Job['tier'], extra: Partial<Job>): Job {
  return {
    id, run_id: 1, found_at: '2026-09-15T05:00:00+00:00', source: `${company} careers`, title, company, location,
    url: `https://example.com/jobs/${id}`, description: 'You will own end to end test automation across web and mobile.',
    age_days: Number(id), direct: false, bucket: 0, bucket_label: '', score, tier, reason: '', visa_sponsorship: 'unclear',
    remote_type: 'unclear', years_required: null,
    salary: { salary_min: null, salary_max: null, salary_currency: '', salary_period: '' },
    salary_below_minimum: false, matched_skills: [], missing_skills: [], status: 'new', ...extra,
  }
}

export interface FakeOptions {
  profile?: Partial<Profile>
  keys?: string[]
  jobs?: Job[]
  groqValid?: boolean
}

export async function useFakeApi(page: Page, opts: FakeOptions = {}) {
  const keys = new Set(opts.keys ?? [])
  const profile: Profile = { ...blankProfile(), ...opts.profile }
  let jobs = (opts.jobs ?? []).map((j) => ({ ...j }))
  let run: RunState = { ...idleRun }
  const calls: { method: string; path: string; body: unknown }[] = []

  const state = (): AppState => ({
    keys: Object.fromEntries(
      Object.values(KEY_NAMES).flat().map((k) => [k, { label: k, set: keys.has(k), hint: keys.has(k) ? 'gsk_…9f2a' : '' }]),
    ),
    ai_ready: keys.has('GROQ_API_KEY'),
    profile,
    run,
    last_run: jobs.length
      ? { id: 1, started_at: new Date().toISOString(), finished_at: new Date().toISOString(), trigger: 'manual', status: 'done',
          stats: { found: 212, scored: 40, matches: jobs.length, per_source: { Himalayas: 31, LinkedIn: 88 }, rejected: { 'asks for 9+ years': 12 } }, error: null }
      : null,
    counts: { new: jobs.filter((j) => j.status === 'new').length },
  })

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()
    let body: unknown = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    calls.push({ method, path, body })

    if (req.headers()['x-shortlist'] !== '1') return json(route, { detail: 'Missing X-Shortlist header.' }, 403)

    if (path === '/api/state') return json(route, state())
    if (path === '/api/reference')
      return json(route, {
        countries: [
          { code: 'PK', name: 'Pakistan' }, { code: 'AE', name: 'United Arab Emirates' }, { code: 'SA', name: 'Saudi Arabia' },
          { code: 'QA', name: 'Qatar' }, { code: 'KW', name: 'Kuwait' }, { code: 'BH', name: 'Bahrain' }, { code: 'OM', name: 'Oman' },
          { code: 'DE', name: 'Germany' }, { code: 'GB', name: 'United Kingdom' },
        ],
        groups: { 'Gulf (GCC)': ['AE', 'SA', 'QA', 'KW', 'BH', 'OM'] },
      })

    const keyMatch = path.match(/^\/api\/keys\/(\w+)$/)
    if (keyMatch && method === 'POST') {
      const b = body as Record<string, string>
      if (keyMatch[1] === 'groq' && (opts.groqValid === false || !b.key?.startsWith('gsk_')))
        return json(route, { ok: false, message: 'Groq rejected this key. Create a new one at console.groq.com/keys.' }, 422)
      KEY_NAMES[keyMatch[1]].forEach((k) => keys.add(k))
      return json(route, { ok: true, message: 'Key works.', keys: state().keys })
    }

    if (path === '/api/resume') {
      Object.assign(profile, {
        has_resume: true, name: 'Sara Khan', headline: 'QA automation engineer',
        summary: 'Four years building web and mobile test automation with Playwright and Appium, mostly for fintech.',
        skills: ['Playwright', 'Python', 'TypeScript', 'Appium', 'API Testing', 'GitHub Actions', 'Selenium', 'Java'],
        years_experience: 4, seniority: 'mid', home_country: 'PK',
        suggested_titles: ['QA Automation Engineer', 'SDET', 'Test Automation Engineer', 'Software Engineer in Test'],
        exclude_title_words: ['principal', 'director', 'intern'], max_years_required: 8,
      })
      return json(route, profile)
    }
    if (path === '/api/titles') {
      profile.titles = (body as { titles: string[] }).titles
      return json(route, profile)
    }
    if (path === '/api/profile' && method === 'PATCH') {
      const changes = body as Record<string, unknown>
      for (const [k, v] of Object.entries(changes)) {
        const cur = (profile as unknown as Record<string, unknown>)[k]
        ;(profile as unknown as Record<string, unknown>)[k] =
          v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' ? { ...cur, ...v } : v
      }
      return json(route, profile)
    }
    if (path === '/api/run' && method === 'POST') {
      run = { ...idleRun, running: true, phase: 'scoring', message: 'Reading QA Automation Engineer at Tamara', sources_total: 6, sources_done: 6, found: 212, to_score: 40, scored: 12, matches: 3 }
      return json(route, run)
    }
    if (path === '/api/run') return json(route, run)
    if (path === '/api/run/stop') {
      run = { ...run, running: false, phase: 'stopped' }
      return json(route, run)
    }
    if (path === '/api/jobs') {
      const status = url.searchParams.get('status') ?? 'new'
      return json(route, { jobs: jobs.filter((j) => j.status === status) })
    }
    const jobMatch = path.match(/^\/api\/jobs\/(.+)$/)
    if (jobMatch && method === 'PATCH') {
      jobs = jobs.map((j) => (j.id === decodeURIComponent(jobMatch[1]) ? { ...j, status: (body as { status: Job['status'] }).status } : j))
      return json(route, { ok: true })
    }
    return json(route, { detail: `Fake API has no handler for ${method} ${path}` }, 404)
  })

  return { calls, profile, keys, finishRun: () => (run = { ...idleRun, phase: 'done' }) }
}
