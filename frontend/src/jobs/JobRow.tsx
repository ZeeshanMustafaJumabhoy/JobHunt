import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { Job, JobStatus } from '../api'

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
    <li className="grid grid-cols-[3.25rem_1fr] gap-x-4 border-b border-rule py-5 sm:grid-cols-[4rem_1fr_auto] sm:gap-x-6">
      <div className="pt-0.5">
        <span className="block text-2xl leading-none font-semibold tabular-nums sm:text-[1.75rem]" aria-label={`Match score ${job.score} out of 100`}>
          {job.score}
        </span>
      </div>

      <div className="min-w-0">
        <h3 className="text-[1.08rem] leading-snug font-medium">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer noopener" className="hover:text-pen hover:underline hover:decoration-pen/40 hover:underline-offset-4">
              {job.title}
            </a>
          ) : (
            job.title
          )}
        </h3>
        <p className="mt-0.5 text-[0.95rem] text-graphite">
          {job.company}, {job.location}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-ink">{job.bucket_label}</span>
          {facts(job).map((f) => (
            <span key={f.text} className={f.tone === 'good' ? 'text-ok' : f.tone === 'warn' ? 'text-alert' : 'text-graphite'}>
              {f.text}
            </span>
          ))}
        </p>
        {job.reason && <p className="mt-3 max-w-[68ch] text-[0.95rem] leading-relaxed">{job.reason}</p>}

        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen(!open)}
          className="mt-2 text-sm text-graphite underline decoration-rule underline-offset-4 hover:text-ink"
        >
          {open ? 'Less' : 'Skills and details'}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={detailsId}
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="overflow-hidden"
            >
              <dl className="mt-4 grid max-w-2xl grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2.5 text-sm">
                {job.matched_skills.length > 0 && (
                  <>
                    <dt className="text-graphite">You have</dt>
                    <dd className="leading-relaxed">
                      {job.matched_skills.map((s, i) => (
                        <span key={s}>
                          <span className="marker">{s}</span>
                          {i < job.matched_skills.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </dd>
                  </>
                )}
                {job.missing_skills.length > 0 && (
                  <>
                    <dt className="text-graphite">They also want</dt>
                    <dd>{job.missing_skills.join(', ')}</dd>
                  </>
                )}
                {salary && (
                  <>
                    <dt className="text-graphite">Salary</dt>
                    <dd>{salary}</dd>
                  </>
                )}
                <dt className="text-graphite">Found on</dt>
                <dd>
                  {job.source}
                  {job.age_days !== null ? `. ${posted(job.age_days)}.` : ''}
                </dd>
              </dl>
              {job.description && (
                <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-graphite">{job.description.slice(0, 600)}…</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="col-start-2 mt-4 flex flex-wrap gap-2 sm:col-start-3 sm:mt-0 sm:flex-col sm:items-stretch">
        {job.status !== 'applied' && (
          <button type="button" onClick={() => onStatus('applied')} className="h-9 rounded-md border border-rule bg-sheet px-3 text-sm hover:border-graphite">
            I applied
          </button>
        )}
        {job.status === 'new' && (
          <button type="button" onClick={() => onStatus('saved')} className="h-9 rounded-md border border-rule bg-sheet px-3 text-sm hover:border-graphite">
            Save
          </button>
        )}
        {job.status !== 'hidden' ? (
          <button type="button" onClick={() => onStatus('hidden')} className="h-9 px-3 text-sm text-graphite hover:text-ink">
            Hide
          </button>
        ) : (
          <button type="button" onClick={() => onStatus('new')} className="h-9 px-3 text-sm text-graphite hover:text-ink">
            Restore
          </button>
        )}
      </div>
    </li>
  )
}
