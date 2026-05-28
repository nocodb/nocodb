import type { WhiteLabelConfig } from 'nocodb-sdk'

/**
 * Default (NocoDB) branding values. Exported so EE callers can fall back to
 * these for any field the white-label config leaves null.
 */
export const DEFAULT_BRANDING = {
  productName: 'NocoDB',
  logoUrl: null as string | null,
  logoDarkUrl: null as string | null,
  faviconUrl: null as string | null,
  brandColor: null as string | null,
}

/**
 * CE stub — white-label is EE-only, so CE always returns NocoDB defaults.
 * EE override at ee/composables/useBranding.ts reads appInfo.whiteLabel.
 */
export const useBranding = createSharedComposable(() => {
  const productName = computed(() => DEFAULT_BRANDING.productName)
  const logoUrl = computed(() => DEFAULT_BRANDING.logoUrl)
  const logoDarkUrl = computed(() => DEFAULT_BRANDING.logoDarkUrl)
  const faviconUrl = computed(() => DEFAULT_BRANDING.faviconUrl)
  const brandColor = computed(() => DEFAULT_BRANDING.brandColor)
  const isWhiteLabelled = computed(() => false)
  const config = computed<WhiteLabelConfig | null>(() => null)

  return {
    productName,
    logoUrl,
    logoDarkUrl,
    faviconUrl,
    brandColor,
    isWhiteLabelled,
    config,
  }
})
