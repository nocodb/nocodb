<script lang="ts" setup>
const route = useRoute()

const router = useRouter()

const { isDark } = useTheme()

const { isWhiteLabelled, productName, logoUrl, logoDarkUrl, faviconUrl } = useBranding()

const brandIcon = computed(() => {
  if (!isWhiteLabelled.value) return null
  return faviconUrl.value || (isDark.value ? logoDarkUrl.value || logoUrl.value : logoUrl.value)
})

// Absolute http(s) only, through the shared guard: `j\tavascript:` scheme smuggling beat the old bespoke check.
const redirectTarget = computed(() => {
  const raw = route.query.ncRedirectUrl
  if (!ncIsString(raw) || !isHttpRedirectUri(raw)) return null

  try {
    const parsed = new URL(raw.trim())
    // `https://nocodb.com@evil.com` would read as nocodb.com.
    return parsed.username || parsed.password ? null : parsed
  } catch {
    return null
  }
})

const redirectUrl = computed(() => redirectTarget.value?.href ?? '')

// URL.hostname is punycode, so a look-alike Unicode host shows up as xn--…
const redirectHost = computed(() => redirectTarget.value?.hostname ?? '')

const urlEl = ref<HTMLElement>()

// The overlay scrollbar is often invisible, so fade the bottom edge while more of the URL is hidden.
const { arrivedState: urlScroll } = useScroll(urlEl)

const backUrl = computed(() => {
  const url = route.query.ncBackUrl
  return ncIsString(url) && isHttpRedirectUri(url) && isSameOriginUrl(url) ? url.trim() : ''
})

if (!redirectUrl.value || !backUrl.value) {
  router.replace('/error/404')
}

const handleRedirect = (proceedToLink = false) => {
  const url = proceedToLink ? redirectUrl.value : backUrl.value

  if (isSameOriginUrl(url, true)) {
    window.history.pushState('object', document.title, url)
    window.location.reload()
  } else {
    window.location.href = url
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 max-w-[452px] mx-auto px-4 text-center">
    <div>
      <img
        v-if="isWhiteLabelled && brandIcon"
        width="56px"
        height="56px"
        :alt="productName"
        :src="brandIcon"
        class="object-contain"
      />
      <GeneralNocodbLogo v-else class="!w-14 !h-14" />
    </div>
    <div class="text-xl font-bold text-nc-content-gray">{{ $t('title.youAreLeavingNocoDB') }}</div>
    <div class="text-sm font-weight-500 text-nc-content-gray-subtle2">{{ $t('title.onlyProceedIfYouTrustThisLink') }}</div>
    <div class="w-full rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight px-3 py-2 text-left">
      <div class="text-sm font-bold text-nc-content-gray break-all" data-testid="nc-leaving-host">{{ redirectHost }}</div>
      <div
        ref="urlEl"
        class="text-xs text-nc-content-gray-subtle break-all max-h-24 overflow-y-auto nc-scrollbar-thin"
        :class="{ 'nc-leaving-url-clipped': !urlScroll.bottom }"
        data-testid="nc-leaving-url"
      >
        {{ redirectUrl }}
      </div>
    </div>
    <div class="flex items-center gap-3 mt-3">
      <NcButton type="secondary" size="small" @click="handleRedirect(false)">
        {{ $t('general.back') }}
      </NcButton>
      <NcButton size="small" @click="handleRedirect(true)">
        {{ $t('labels.proceedToLink') }}
      </NcButton>
    </div>
  </div>
</template>

<style scoped>
.nc-leaving-url-clipped {
  mask-image: linear-gradient(to bottom, black 70%, transparent);
}
</style>
