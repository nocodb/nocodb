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

  const DEFAULT_FAVICON = '/favicon.ico'

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
    // Framework-injected favicons (nuxt.config `app.head.link`) compete with our
    // managed one — browsers may keep showing the original. Remove every
    // non-managed icon link so ours is the only one the browser can pick.
    document
      .querySelectorAll(`link[rel~='icon']:not(#${FAVICON_ID}), link[rel='shortcut icon']:not(#${FAVICON_ID})`)
      .forEach((el) => el.remove())

    // Point the single managed link at the custom favicon, or back at the
    // built-in default when white-labelling is off / no favicon is set.
    const el = ensureFaviconLink()
    const next = url || DEFAULT_FAVICON
    if (el.getAttribute('href') !== next) el.setAttribute('href', next)
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
