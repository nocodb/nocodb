import type { WhiteLabelConfig } from 'nocodb-sdk'
import { DEFAULT_BRANDING } from '~/composables/useBranding'

/**
 * EE override — reads sanitized white-label config from appInfo.
 * appInfo.whiteLabel is null on unlicensed / unconfigured instances,
 * in which case all getters fall back to NocoDB defaults.
 *
 * Same-origin URLs (`/dltemp/...`, `/whiteLabel/...`) are joined with the
 * backend's `ncSiteUrl` so they resolve against the API host rather than the
 * frontend dev server (which serves nothing for those paths).
 */
export const useBranding = createSharedComposable(() => {
  const { appInfo } = useGlobal()

  const config = computed<WhiteLabelConfig | null>(() => appInfo.value?.whiteLabel ?? null)

  const isWhiteLabelled = computed(() => !!config.value?.enabled)

  function joinSiteUrl(url: string | null | undefined): string | null {
    if (!url) return null
    if (/^https?:\/\//i.test(url)) return url
    if (typeof window === 'undefined') return url
    const base = new URL(appInfo.value?.ncSiteUrl || '/', window.location.origin)
    return new URL(url, base).toString()
  }

  const productName = computed(
    () => config.value?.productName?.trim() || DEFAULT_BRANDING.productName,
  )
  const logoUrl = computed(
    () =>
      joinSiteUrl(config.value?.logoUrl) ||
      // Fall back to the dark logo so a single uploaded logo shows in both
      // modes (mirrors the dark→light fallback below).
      joinSiteUrl(config.value?.logoDarkUrl) ||
      DEFAULT_BRANDING.logoUrl,
  )
  const logoDarkUrl = computed(
    () =>
      joinSiteUrl(config.value?.logoDarkUrl) ||
      joinSiteUrl(config.value?.logoUrl) ||
      DEFAULT_BRANDING.logoDarkUrl,
  )
  const faviconUrl = computed(
    () => joinSiteUrl(config.value?.faviconUrl) || DEFAULT_BRANDING.faviconUrl,
  )
  const brandColor = computed(() => config.value?.brandColor || DEFAULT_BRANDING.brandColor)
  const formBannerUrl = computed(
    () => joinSiteUrl(config.value?.formBannerUrl) || DEFAULT_BRANDING.formBannerUrl,
  )

  return {
    productName,
    logoUrl,
    logoDarkUrl,
    faviconUrl,
    brandColor,
    formBannerUrl,
    isWhiteLabelled,
    config,
  }
})
