import { Bookmark, Building2, Check, ChevronDown, Clock, ExternalLink, EyeOff, MapPin, RotateCcw, Wallet } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { Job, JobStatus } from '../api'
import { Badge, Button, ScoreRing } from '../ui/ui'

const REMOTE: Record<Job['remote_type'], string> = {
  remote_worldwide: 'Remote worldwide',
  remote_regional: 'Remote, one region only',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unclear: '',
}

export function posted(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return 'Posted today'
  if (days === 1) return 'Posted yesterday'
  return `Posted ${days} days ago`
}

function salaryText(job: Job): string {
  const { salary_min: lo, salary_max: hi, salary_currency: cur, salary_period: per } = job.salary
  if (!lo && !hi) return ''
  const range = lo && hi && lo !== hi ? `${lo.toLocaleString()} to ${hi.toLocaleString()}` : (hi ?? lo)!.toLocaleString()
  return `${range} ${cur}${per ? ` a ${per}` : ''}`
}

/** Facts that change whether it's worth applying, most decisive first. */
export function facts(job: Job): { text: string; tone: 'good' | 'warn' | 'plain' }[] {
  const out: { text: string; tone: 'good' | 'warn' | 'plain' }[] = []
  if (job.visa_sponsorship === 'yes') out.push({ text: 'Sponsors visas', tone: 'good' })
  if (job.visa_sponsorship === 'no') out.push({ text: 'No sponsorship', tone: 'warn' })
  // The place label already says "Remote, worldwide" for that bucket.
  if (REMOTE[job.remote_type] && !(job.remote_type === 'remote_worldwide' && job.bucket === 1))
    out.push({ text: REMOTE[job.remote_type], tone: 'plain' })
  if (job.direct) out.push({ text: "From the employer's site", tone: 'plain' })
  if (job.years_required) out.push({ text: `Asks for ${job.years_required}+ years`, tone: 'plain' })
  if (job.salary_below_minimum) out.push({ text: 'Pays below your minimum', tone: 'warn' })
  return out
}

function safeHref(url: string): string | undefined {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined
  } catch {
    return undefined
  }
}

export function JobRow({ job, onStatus }: { job: Job; onStatus: (status: JobStatus) => void }) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const href = safeHref(job.url)
  const salary = salaryText(job)
  const detailsId = `job-${job.id.replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <motion.li
      layout={reduce ? false : 'position'}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
      className="card group p-5 transition-shadow duration-200 hover:shadow-raised sm:p-6"
    >
      <div className="flex gap-4 sm:gap-5">
        <ScoreRing score={job.score} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h3 className="text-[1.0625rem] leading-snug font-semibold tracking-tight">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-brand"
                  >
                    {job.title}
                    <ExternalLink aria-hidden className="size-3.5 text-faint transition-colors group-hover:text-brand" />
                  </a>
                ) : (
                  job.title
                )}
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 aria-hidden className="size-4 text-faint" />
                  {job.company}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4 text-faint" />
                  {job.location}
                </span>
                {job.age_days !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden className="size-4 text-faint" />
                    {posted(job.age_days)}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {job.status !== 'applied' && (
                <Button variant="primary" size="sm" icon={Check} onClick={() => onStatus('applied')}>
                  I applied
                </Button>
              )}
              {job.status === 'new' && (
                <Button variant="secondary" size="sm" icon={Bookmark} onClick={() => onStatus('saved')}>
                  Save
                </Button>
              )}
              {job.status !== 'hidden' ? (
                <Button variant="ghost" size="sm" icon={EyeOff} onClick={() => onStatus('hidden')}>
                  Hide
                </Button>
              ) : (
                <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onStatus('new')}>
                  Restore
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="brand">{job.bucket_label}</Badge>
            {facts(job).map((f) => (
              <Badge key={f.text} tone={f.tone === 'good' ? 'success' : f.tone === 'warn' ? 'danger' : 'neutral'}>
                {f.text}
              </Badge>
            ))}
          </div>

          {job.reason && <p className="mt-3 max-w-[70ch] text-[0.9375rem] leading-relaxed text-ink/85">{job.reason}</p>}

          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen(!open)}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover sm:min-h-9"
          >
            {open ? 'Less' : 'Skills and details'}
            <ChevronDown aria-hidden className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id={detailsId}
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid gap-4 rounded-xl bg-subtle/70 p-4 sm:grid-cols-2">
                  {job.matched_skills.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted">You have</p>
                      <div className="flex flex-wrap gap-1.5">
                        {job.matched_skills.map((s) => (
                          <Badge key={s} tone="success" icon={Check}>
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {job.missing_skills.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted">They also want</p>
                      <div className="flex flex-wrap gap-1.5">
                        {job.missing_skills.map((s) => (
                          <Badge key={s} tone="warning">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {salary && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted">Salary</p>
                      <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                        <Wallet aria-hidden className="size-4 text-faint" />
                        {salary}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted">Found on</p>
                    <p className="text-sm font-medium">{job.source}</p>
                  </div>
                  {job.description && (
                    <p className="text-sm leading-relaxed text-muted sm:col-span-2">{job.description.slice(0, 600)}…</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.li>
  )
}
