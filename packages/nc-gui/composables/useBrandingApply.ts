/**
 * Applies white-label side effects to the document on boot and whenever the
 * config changes — favicon swap and --color-brand-500 CSS override.
 *
 * Document title is intentionally not handled here — pages already manage
 * their own titles via `useTitle()`; they read the product name from
 * `useBranding().productName`.
 */
export const useBrandingApply = createSharedComposable(() => {
  if (typeof document === 'undefined') return

  const { faviconUrl, brandColor } = useBranding()

  const FAVICON_ID = 'nc-favicon'
  const STYLE_ID = 'nc-brand-color-override'

  function ensureFaviconLink(): HTMLLinkElement {
    let el = document.getElementById(FAVICON_ID) as HTMLLinkElement | null
    if (!el) {
      el = document.createElement('link')
      el.id = FAVICON_ID
      el.rel = 'icon'
      document.head.appendChild(el)
    }
    return el
  }

  function applyFavicon(url: string | null) {
    if (!url) {
      const el = document.getElementById(FAVICON_ID)
      if (el) el.remove()
      // Remove non-managed favicons so the custom one doesn't fight defaults.
      // We only touch <link rel="icon"> not pointing at our managed id; the
      // built-in favicons stay registered, just hidden under the override.
      return
    }
    const el = ensureFaviconLink()
    if (el.href !== url) el.href = url
  }

  function hexToRgbTuple(hex: string): string | null {
    const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    if (!m) return null
    let h = m[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    const num = parseInt(h, 16)
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
  }

  function applyBrandColor(hex: string | null) {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!hex) {
      style?.remove()
      return
    }
    const rgb = hexToRgbTuple(hex)
    if (!rgb) return
    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
      document.head.appendChild(style)
    }
    // Override both the hex and rgb-tuple forms so ant-design rgba(...) usages
    // pick up the new color too.
    style.textContent =
      `:root, [theme='dark'] { --color-brand-500: ${hex}; --rgb-color-brand-500: ${rgb}; }`
  }

  watch(
    faviconUrl,
    (v) => applyFavicon(v),
    { immediate: true },
  )

  watch(
    brandColor,
    (v) => applyBrandColor(v),
    { immediate: true },
  )
})
