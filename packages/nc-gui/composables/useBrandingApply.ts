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
 *
 * SEO/social meta (og:*, twitter:*, description) is intentionally NOT handled:
 * the app runs SPA (ssr: false), so those are baked into the static index.html
 * and crawlers/link-unfurlers never execute our JS — overriding them at runtime
 * would be theatre. theme-color and apple-touch-icon DO take effect at runtime
 * (browser chrome, iOS add-to-home-screen reads the live DOM), so we manage them.
 */
export const useBrandingApply = createSharedComposable(() => {
  if (typeof document === 'undefined') return

  const { faviconUrl, brandColor } = useBranding()

  const { setTheme } = useAntDvTheme()

  const { clearColorCache } = useTheme()

  const FAVICON_ID = 'nc-favicon'
  const STYLE_ID = 'nc-brand-color-override'

  const DEFAULT_FAVICON = '/favicon.ico'
  const DEFAULT_THEME_COLOR = '#3366FF'
  const DEFAULT_APPLE_TOUCH_ICON = '/apple-touch-icon-180x180.png'

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

    // iOS home-screen icon — point it at the white-label favicon too (better a
    // small brand icon than the NocoDB one); restore the default when off.
    const apple = document.querySelector("link[rel~='apple-touch-icon']") as HTMLLinkElement | null
    if (apple) {
      const appleNext = url || DEFAULT_APPLE_TOUCH_ICON
      if (apple.getAttribute('href') !== appleNext) apple.setAttribute('href', appleNext)
    }
  }

  // Mobile browser chrome / PWA splash colour. Follows the brand colour; resets
  // to the built-in NocoDB blue when white-labelling is off / no colour set.
  function applyThemeColor(hex: string | null) {
    const meta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null
    if (!meta) return
    const next = hex || DEFAULT_THEME_COLOR
    if (meta.getAttribute('content') !== next) meta.setAttribute('content', next)
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

  watch(
    brandColor,
    async (v) => {
      applyBrandColor(v)
      applyThemeColor(v)

      // The brand-colour CSS vars (--color-brand-*, --rgb-color-brand-*, --nc-brand-accent*)
      // just changed (or were removed on reset). Canvas surfaces can't read CSS vars, so
      // useTheme.getColor() memoises getComputedStyle-resolved brand rgb in colorCache, keyed
      // only by the var name — it stays stale until cleared (today only on dark-mode toggle).
      // Clear it AFTER the override <style> has landed and styles recompute; clearing earlier
      // lets the next getColor() re-cache the OLD value and silently reintroduce the bug.
      await nextTick()
      clearColorCache()
    },
    { immediate: true },
  )
})
