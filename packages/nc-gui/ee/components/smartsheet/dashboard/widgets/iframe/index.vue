<script setup lang="ts">
import type { IframeWidgetType } from 'nocodb-sdk'
import { isIframeUrlAllowed } from '~/components/smartsheet/dashboard/widgets/iframe/utils'

interface Props {
  widget: IframeWidgetType
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const key = ref(0)
const hasLoaded = ref(false)
const loadTimedOut = ref(false)
let loadTimer: ReturnType<typeof setTimeout> | null = null

const { appInfo } = useGlobal()

const scriptConfig = computed(() => {
  return props.widget.config || {}
})

const isValidUrl = computed(() => {
  try {
    const newUrl = new URL(scriptConfig.value?.url)

    if (!isIframeUrlAllowed(scriptConfig.value?.url, appInfo.value.iframeWhitelistDomains, newUrl)) {
      return false
    }

    return true
  } catch (e) {
    return false
  }
})

const displayHost = computed(() => {
  try {
    return new URL(scriptConfig.value?.url).hostname
  } catch {
    return scriptConfig.value?.url
  }
})

function resetLoadState() {
  hasLoaded.value = false
  loadTimedOut.value = false
  if (loadTimer) clearTimeout(loadTimer)
  // Browser fires `load` event even when X-Frame-Options blocks the page.
  // We can't tell blocked from loaded cross-origin, so we show an unobtrusive
  // "Open in new tab" affordance if it takes longer than usual to load.
  loadTimer = setTimeout(() => {
    if (!hasLoaded.value) loadTimedOut.value = true
  }, 4000)
}

function onIframeLoad() {
  hasLoaded.value = true
}

watch(
  () => scriptConfig.value?.url,
  () => {
    key.value++
    resetLoadState()
  },
)

onMounted(() => {
  resetLoadState()
})

onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer)
})
</script>

<template>
  <div
    :class="{
      'items-center justify-center': !isValidUrl,
    }"
    class="nc-iframe-widget !rounded-xl h-full w-full flex flex-col group relative overflow-hidden bg-nc-bg-default"
  >
    <SmartsheetDashboardWidgetsCommonWidgetsError v-if="!isValidUrl" :error="widget.error">
      {{ $t('msg.error.invalidURL') }}
    </SmartsheetDashboardWidgetsCommonWidgetsError>

    <template v-else>
      <iframe
        :key="key"
        :class="{
          'pointer-events-none': isEditing,
        }"
        :src="scriptConfig?.url"
        allowfullscreen
        allow="fullscreen"
        class="w-full h-full border-0"
        @load="onIframeLoad"
      />

      <a
        :href="scriptConfig?.url"
        target="_blank"
        rel="noopener noreferrer"
        class="nc-iframe-open-external absolute top-2.5 right-12 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-nc-content-gray-subtle hover:text-nc-content-brand border border-nc-border-gray-medium shadow-sm flex items-center gap-1"
        :title="scriptConfig?.url"
      >
        <GeneralIcon icon="externalLink" class="w-3 h-3" />
        {{ $t('labels.openInNewTab') }}
      </a>

      <div
        v-if="loadTimedOut"
        class="absolute bottom-2 left-2 right-2 z-10 bg-nc-bg-orange-light text-nc-content-orange-dark text-caption rounded-md px-3 py-2 flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-2 truncate">
          <GeneralIcon icon="ncAlertTriangle" class="flex-shrink-0" />
          <span class="truncate">{{ displayHost }} may not allow embedding.</span>
        </div>
        <a
          :href="scriptConfig?.url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-shrink-0 font-medium underline hover:no-underline"
        >
          {{ $t('labels.openInNewTab') }}
        </a>
      </div>
    </template>

    <SmartsheetDashboardWidgetsCommonContext v-if="isEditing" class="absolute top-2.5 right-2.5 z-20" :widget="widget" />
  </div>
</template>

<style scoped lang="scss">
.nc-iframe-widget {
  iframe {
    @apply bg-nc-bg-default;
  }
}
</style>
