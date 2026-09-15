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
