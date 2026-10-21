/**
 * iOS Safari zooms the page when an input under 16px gets focus and doesn't zoom back out.
 * `maximum-scale=1` stops that zoom on iOS while pinch-zoom keeps working there; other
 * platforms keep the default, since elsewhere it would block pinch-zoom.
 */
export default defineNuxtPlugin(() => {
  if (!isIOSDevice()) return

  useHead({
    meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' }],
  })
})
