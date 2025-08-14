<script setup lang="ts">
import type { IframeWidgetType } from 'nocodb-sdk'

interface Props {
  widget: IframeWidgetType
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const key = ref(0)

const scriptConfig = computed(() => {
  return props.widget.config || {}
})

const isValidUrl = computed(() => {
  try {
    new URL(scriptConfig.value?.url)
    return true
  } catch (e) {
    return false
  }
})

watch([() => scriptConfig.value?.url], () => {
  key.value++
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
      :key="key"
      :class="{
        'pointer-events-none': isEditing,
      }"
      :src="scriptConfig?.url"
      class="w-full h-full border-0"
    />

    <SmartsheetDashboardWidgetsCommonContext v-if="isEditing" class="absolute top-2.5 right-2.5 z-20" :widget="widget" />
  </div>
</template>

<style scoped lang="scss">
.nc-iframe-widget {
  iframe {
    background: white;
  }
}
</style>
