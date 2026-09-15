export type WorkMode = 'remote' | 'hybrid' | 'onsite'

export interface CareerPage {
  provider: string
  slug: string
  company: string
}

export interface Profile {
  name: string
  headline: string
  summary: string
  has_resume: boolean
  skills: string[]
  years_experience: number | null
  seniority: string
  suggested_titles: string[]
  titles: string[]
  title_keywords: string[]
  work_modes: WorkMode[]
  home_country: string
  target_countries: string[]
  cities: string[]
  needs_visa: boolean
  willing_to_relocate: boolean
  max_years_required: number | null
  salary: { minimum: number | null; currency: string; period: 'month' | 'year'; strict: boolean }
  exclude_title_words: string[]
  dealbreakers: string
  max_age_days: number
  min_match_score: number
  sources: {
    remote_boards: boolean
    career_pages: boolean
    adzuna: boolean
    jooble: boolean
    jsearch: boolean
    linkedin: boolean
  }
  career_pages: CareerPage[]
  max_jobs_to_score: number
  digest_enabled: boolean
  digest_time: string
  setup_step: string
  setup_complete: boolean
}

export interface KeyStatus {
  label: string
  set: boolean
  hint: string
}

export interface RunState {
  running: boolean
  run_id: number | null
  phase: 'idle' | 'searching' | 'filtering' | 'scoring' | 'done' | 'failed' | 'stopped'
  message: string
  sources_done: number
  sources_total: number
  found: number
  to_score: number
  scored: number
  matches: number
  log: string[]
}

export interface RunRecord {
  id: number
  started_at: string
  finished_at: string | null
  trigger: string
  status: string
  stats: {
    found?: number
    new?: number
    fresh?: number
    passed_rules?: number
    scored?: number
    matches?: number
    per_source?: Record<string, number>
    rejected?: Record<string, number>
  }
  error: string | null
}

export interface AppState {
  keys: Record<string, KeyStatus>
  ai_ready: boolean
  profile: Profile
  run: RunState
  last_run: RunRecord | null
  counts: Record<string, number>
}

export type Tier = 'apply' | 'strong' | 'maybe' | 'low'
export type JobStatus = 'new' | 'saved' | 'applied' | 'hidden'

export interface Job {
  id: string
  run_id: number
  found_at: string
  source: string
  title: string
  company: string
  location: string
  url: string
  description: string
  age_days: number | null
  direct: boolean
  bucket: number
  bucket_label: string
  score: number
  tier: Tier
  reason: string
  visa_sponsorship: 'yes' | 'no' | 'unclear'
  remote_type: 'onsite' | 'hybrid' | 'remote_regional' | 'remote_worldwide' | 'unclear'
  years_required: number | null
  salary: {
    salary_min: number | null
    salary_max: number | null
    salary_currency: string
    salary_period: string
  }
  salary_below_minimum: boolean
  matched_skills: string[]
  missing_skills: string[]
  resume_tips: string[]
  status: JobStatus
}

export type AtsStatus = 'good' | 'warning' | 'bad'

export interface AtsCheck {
  category: string
  status: AtsStatus
  note: string
}

export interface AtsScan {
  scanned_at: string
  score: number
  summary: string
  checks: AtsCheck[]
  suggestions: string[]
}

export interface Reference {
  countries: { code: string; name: string }[]
  groups: Record<string, string[]>
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: { 'X-Shortlist': '1' } }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.body = JSON.stringify(body)
    ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
  }
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError("Can't reach Shortlist. Check that the terminal running it is still open.", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : data.message
    throw new ApiError(detail || `Something went wrong (HTTP ${res.status}).`, res.status)
  }
  return data as T
}

export const api = {
  state: () => request<AppState>('GET', '/api/state'),
  reference: () => request<Reference>('GET', '/api/reference'),
  saveKey: (name: string, body: Record<string, string>) =>
    request<{ ok: boolean; message: string; keys: Record<string, KeyStatus> }>('POST', `/api/keys/${name}`, body),
  deleteKey: (name: string) => request<{ keys: Record<string, KeyStatus> }>('DELETE', `/api/keys/${name}`),
  getResumeScan: () => request<{ scan: AtsScan | null }>('GET', '/api/resume/scan'),
  scanResume: () => request<{ scan: AtsScan }>('POST', '/api/resume/scan'),
  uploadResume: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Profile>('POST', '/api/resume', form)
  },
  saveTitles: (titles: string[]) => request<Profile>('POST', '/api/titles', { titles }),
  patchProfile: (changes: Partial<Profile>) => request<Profile>('PATCH', '/api/profile', changes),
  addCareerPage: (url: string) =>
    request<{ profile: Profile; openings: number; page: CareerPage }>('POST', '/api/career-pages', { url }),
  startRun: () => request<RunState>('POST', '/api/run'),
  runStatus: () => request<RunState>('GET', '/api/run'),
  stopRun: () => request<RunState>('POST', '/api/run/stop'),
  jobs: (params: { status?: JobStatus; minScore?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.status) q.set('status', params.status)
    q.set('min_score', String(params.minScore ?? 50))
    return request<{ jobs: Job[] }>('GET', `/api/jobs?${q}`)
  },
  setJobStatus: (id: string, status: JobStatus) =>
    request<{ ok: boolean }>('PATCH', `/api/jobs/${encodeURIComponent(id)}`, { status }),
  runs: () => request<{ runs: RunRecord[] }>('GET', '/api/runs'),
  testDigest: () => request<{ message: string }>('POST', '/api/digest/test'),
  clearHistory: () => request<{ ok: boolean }>('POST', '/api/history/clear'),
}
