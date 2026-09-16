import { isPreviewMode } from '../preview'

/** Shown on every step in preview mode, so a visitor doesn't think they need
 * to fill anything in for real — easy to mistake for the live app,
 * especially on a small screen. */
export function PreviewNotice() {
  if (!isPreviewMode()) return null
  return (
    <div className="mb-6 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-center">
      <p className="text-sm font-semibold text-brand-ink">This is just a preview — click Continue. No need to add anything here.</p>
    </div>
  )
}
