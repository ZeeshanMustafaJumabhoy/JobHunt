import type { AppState, KeyStatus, Profile, Reference } from '../api'
import { PREVIEW_COUNTRIES, PREVIEW_GROUPS } from './countries'

/** Add ?preview=1 to the URL to click through every setup step with no
 * validation and no saved data, just to look at the screens. Never active
 * unless that flag is present, so normal use is unaffected. */
export function isPreviewMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('preview') === '1'
  } catch {
    return false
  }
}

const NO_KEY: KeyStatus = { label: '', set: false, hint: '' }

/** A brand-new, never-set-up profile — the state a real first run starts
 * from. Lets a hosted, backend-less preview (e.g. a static Netlify deploy)
 * boot straight into the setup wizard with no server at all. */
const PREVIEW_PROFILE: Profile = {
  name: '',
  headline: '',
  summary: '',
  has_resume: false,
  skills: [],
  years_experience: null,
  seniority: '',
  suggested_titles: [],
  titles: [],
  title_keywords: [],
  work_modes: ['remote', 'hybrid', 'onsite'],
  home_country: '',
  target_countries: [],
  cities: [],
  needs_visa: true,
  willing_to_relocate: true,
  max_years_required: null,
  salary: { minimum: null, currency: 'USD', period: 'month', strict: false },
  exclude_title_words: [],
  dealbreakers: '',
  max_age_days: 21,
  min_match_score: 50,
  sources: { remote_boards: true, career_pages: true, adzuna: true, jooble: true, jsearch: true, linkedin: false },
  career_pages: [],
  max_jobs_to_score: 60,
  digest_enabled: false,
  digest_time: '09:00',
  setup_step: '',
  setup_complete: false,
}

/** The whole app's bootstrap state, faked so preview mode never needs the
 * initial /api/state and /api/reference calls — the two that would otherwise
 * make a backend-less hosted preview fail before it even shows anything. */
export const PREVIEW_APP_STATE: AppState = {
  keys: {
    GROQ_API_KEY: NO_KEY,
    OPENROUTER_API_KEY: NO_KEY,
    ADZUNA_APP_ID: NO_KEY,
    ADZUNA_APP_KEY: NO_KEY,
    JOOBLE_API_KEY: NO_KEY,
    RAPIDAPI_KEY: NO_KEY,
    GMAIL_ADDRESS: NO_KEY,
    GMAIL_APP_PASSWORD: NO_KEY,
    RECIPIENT_EMAIL: NO_KEY,
  },
  ai_ready: false,
  profile: PREVIEW_PROFILE,
  run: { running: false, run_id: null, phase: 'idle', message: '', sources_done: 0, sources_total: 0, found: 0, to_score: 0, scored: 0, matches: 0, log: [] },
  last_run: null,
  counts: {},
}

export const PREVIEW_REFERENCE: Reference = {
  countries: PREVIEW_COUNTRIES.map((c) => ({ code: c.code, name: c.name })),
  groups: PREVIEW_GROUPS,
}
