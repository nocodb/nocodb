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

const sandboxAttribute = computed(() => {
  if (!scriptConfig.value?.sandbox || scriptConfig.value?.sandbox?.length === 0) {
    return undefined
  }
  return scriptConfig.value.sandbox.join(' ')
})

watch([() => scriptConfig.value?.url, () => scriptConfig.value?.sandbox], () => {
  key.value++
})
</script>

<template>
  <div class="nc-iframe-widget !rounded-xl h-full w-full flex group relative overflow-hidden">
    <iframe
      :key="key"
      :class="{
        'pointer-events-none': isEditing,
      }"
      :src="scriptConfig?.url"
      :sandbox="sandboxAttribute"
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
