/**
 * Applies white-label side effects to the document on boot and whenever the
 * config changes — favicon swap and the full brand-colour ramp override.
 *
 * The admin picks a single seed hex; we derive the entire `--color-brand-*`
 * ramp (light + inverted dark) plus the Ant Design primary tokens from it
 * (see utils/brandScale.ts), so every accented surface recolours coherently.
 *
 * Document title is intentionally not handled here — pages already manage
 * their own titles via `useTitle()`; they read the product name from
 * `useBranding().productName`.
 */
export const useBrandingApply = createSharedComposable(() => {
  if (typeof document === 'undefined') return

  const { faviconUrl, brandColor } = useBranding()

  const { setTheme } = useAntDvTheme()

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

  function applyBrandColor(hex: string | null) {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    const css = hex ? buildBrandStyleCss(hex) : null

    // No colour (or invalid hex) → drop the override and reset Ant Design's
    // ConfigProvider back to the built-in NocoDB blue.
    if (!css) {
      style?.remove()
      setTheme()
      return
    }

    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
      document.head.appendChild(style)
    }
    style.textContent = css

    // Keep Ant Design's ConfigProvider token in sync with the injected CSS
    // vars (some antd components read the JS token at render time).
    setTheme({ primaryColor: hex! })
  }

  watch(faviconUrl, (v) => applyFavicon(v), { immediate: true })

  watch(brandColor, (v) => applyBrandColor(v), { immediate: true })
})
