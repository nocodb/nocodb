<script setup lang="ts">
import type { IframeWidgetConfig, WidgetType } from 'nocodb-sdk'

interface Props {
  widget?: WidgetType
  config?: IframeWidgetConfig
  isReadonly?: boolean
}

const props = defineProps<Props>()

const isLoading = ref(true)
const error = ref<string | null>(null)

// Validate URL
const isValidUrl = computed(() => {
  if (!props.config?.url) return false

  try {
    const url = new URL(props.config.url)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
})

// Generate sandbox value
const sandboxValue = computed(() => {
  if (!props.config?.sandbox) {
    // Default sandbox permissions for security
    return 'allow-scripts allow-same-origin allow-forms allow-popups'
  }

  return props.config.sandbox.join(' ')
})

// Handle iframe events
const onIframeLoad = () => {
  isLoading.value = false
  error.value = null
}

const onIframeError = () => {
  isLoading.value = false
  error.value = 'Failed to load content'
}

// Reset loading state when URL changes
watch(
  () => props.config?.url,
  () => {
    if (props.config?.url) {
      isLoading.value = true
      error.value = null
    }
  },
)
</script>

<template>
  <div class="iframe-widget">
    <div v-if="!config?.url" class="no-url">
      <GeneralIcon icon="web" class="text-4xl text-gray-400 mb-2" />
      <p class="text-gray-500 text-sm">No URL configured</p>
    </div>

    <div v-else-if="!isValidUrl" class="invalid-url">
      <GeneralIcon icon="web" class="text-4xl text-red-400 mb-2" />
      <p class="text-red-500 text-sm">Invalid URL provided</p>
    </div>

    <div v-else class="iframe-container">
      <iframe
        :src="config.url"
        :height="config.height || '100%'"
        :allowfullscreen="config.allowFullscreen"
        :sandbox="sandboxValue"
        class="iframe-content"
        @load="onIframeLoad"
        @error="onIframeError"
      />

      <div v-if="isLoading" class="iframe-loading">
        <a-spin size="large" />
        <p class="text-gray-500 text-sm mt-2">Loading content...</p>
      </div>

      <div v-if="error" class="iframe-error">
        <MaterialSymbolsErrorRounded class="text-4xl text-red-400 mb-2" />
        <p class="text-red-500 text-sm">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.iframe-widget {
  @apply w-full h-full relative;
}

.no-url,
.invalid-url {
  @apply w-full h-full flex flex-col items-center justify-center;
}

.iframe-container {
  @apply w-full h-full relative;
}

.iframe-content {
  @apply w-full h-full border-0;
}

.iframe-loading,
.iframe-error {
  @apply absolute inset-0 flex flex-col items-center justify-center bg-white;
}

.iframe-loading {
  @apply bg-gray-50;
}
</style>
