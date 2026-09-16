import type { CSSProperties } from 'react'

/** A branded loader for slow AI waits: reading a resume, scanning it against
 * ATS rules, or running a search. Not for buttons or list loading — those
 * stay on the plain Spinner and Skeleton, which read faster for quick waits. */
export function Loader({ size = 64, message }: { size?: number; message?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4.5"
      style={{ '--loader-size': `${size}px` } as CSSProperties}
      role="status"
      aria-label={message ?? 'Loading'}
    >
      <div className="loader-orbit">
        <div className="loader-ring loader-ring-1" />
        <div className="loader-ring loader-ring-2" />
        <div className="loader-icon">
          <svg viewBox="0 0 24 24" width={size * 0.45} height={size * 0.45} fill="none" aria-hidden>
            <path
              d="M7 8V6.5C7 5.67 7.67 5 8.5 5H15.5C16.33 5 17 5.67 17 6.5V8"
              stroke="var(--color-brand)"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
            <rect x="4" y="8" width="16" height="11" rx="2.5" fill="url(#loaderBriefcaseGradient)" />
            <path d="M4 12.5H20" stroke="white" strokeWidth={1.4} opacity={0.9} />
            <rect x="10" y="11.2" width="4" height="2.8" rx="1" fill="white" />
            <defs>
              <linearGradient id="loaderBriefcaseGradient" x1="4" y1="8" x2="20" y2="19" gradientUnits="userSpaceOnUse">
                <stop style={{ stopColor: 'var(--color-brand)' }} />
                <stop offset="1" style={{ stopColor: 'var(--color-brand-2)' }} />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      {message && (
        <p className="loader-message text-sm font-medium tracking-tight" aria-hidden>
          {message}
        </p>
      )}
    </div>
  )
}
