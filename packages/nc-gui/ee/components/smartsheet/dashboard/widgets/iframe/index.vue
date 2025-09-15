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

const iframeRef = ref<HTMLIFrameElement | null>(null)

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

watch(
  () => scriptConfig.value?.url,
  () => {
    key.value++
  },
)

useEventListener('message', (event) => {
  if (!isValidUrl.value || !supportsKeyboardLock) return

  try {
    const iframeOrigin = new URL(scriptConfig.value?.url).origin
    if (event.origin !== iframeOrigin) return
  } catch (e) {
    return
  }

  if (event.data.type === 'request-fullscreen-esc-key-lock') {
    if ((window as any).ncLockAcquired) return
    ;(window as any).ncLockAcquired = true
    navigator.keyboard.lock(['Escape'])
  } else if (event.data.type === 'request-fullscreen-esc-key-unlock') {
    ;(window as any).ncLockAcquired = false
    navigator.keyboard.unlock()
  } else if (event.data.type === 'request-nc-iframe-fullscreen-supported') {
    // ✅ Send back message to iframe
    iframeRef.value?.contentWindow?.postMessage({ type: 'nc-iframe-fullscreen-supported', supported: true }, event.origin)
  }
})
</script>

<template>
  <div
    :class="{
      'items-center justify-center': !isValidUrl,
    }"
    class="nc-iframe-widget !rounded-xl h-full w-full flex group relative overflow-hidden"
  >
    <SmartsheetDashboardWidgetsCommonWidgetsError v-if="!isValidUrl" :error="widget.error">
      Invalid URL
    </SmartsheetDashboardWidgetsCommonWidgetsError>
    <iframe
      v-else
      ref="iframeRef"
      :key="key"
      :class="{
        'pointer-events-none': isEditing,
      }"
      :src="scriptConfig?.url"
      allowfullscreen
      allow="fullscreen"
      class="w-full h-full border-0"
    />

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
