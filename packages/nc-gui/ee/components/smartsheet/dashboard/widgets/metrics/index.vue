<script setup lang="ts">
import type { MetricWidgetType } from 'nocodb-sdk'
import { colorColoured, colorFilled } from './config/color'

interface Props {
  widget: MetricWidgetType
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const widgetRef = toRef(props, 'widget')

const widgetStore = useWidgetStore()
const widgetData = ref<any>(null)
const isLoading = ref(false)

const colors = computed(() => {
  const type = (widgetRef.value?.config.appearance as any)?.type ?? 'default'
  if (type === 'filled') {
    return colorFilled.find((c) => c.id === (widgetRef.value?.config.appearance as any)?.theme) ?? colorFilled[0]
  } else if (type === 'coloured') {
    return colorColoured.find((c) => c.id === (widgetRef.value?.config.appearance as any)?.theme) ?? colorColoured[0]
  }

  return {
    fill: 'white',
    color: 'var(--nc-content-gray-subtle2)',
  }
})

async function loadData() {
  if (!widgetRef.value?.id || widgetRef.value?.error) return
  isLoading.value = true

  widgetData.value = await widgetStore.loadWidgetData(widgetRef.value.id)
  isLoading.value = false
}

onMounted(() => {
  loadData()
})

watch(
  [() => widgetRef.value?.config],
  () => {
    loadData()
  },
  {
    deep: true,
  },
)
</script>

<template>
  <div
    class="nc-metric-widget !rounded-xl h-full w-full p-4 flex group flex-col gap-1 relative"
    :style="{
      backgroundColor: colors?.fill,
    }"
  >
    <div
      :class="{
        'mb-1.5': widget.description,
        'mb-3': !widget.description,
      }"
      class="flex items-center"
    >
      <div
        :style="{
          color: colors?.color,
        }"
        class="text-nc-content-gray-emphasis flex-1 truncate pr-1 text-subHeading2"
      >
        {{ widget.title }}
      </div>
      <SmartsheetDashboardWidgetsCommonContext v-if="isEditing" :widget="widget" />
    </div>
    <div v-if="widget.description" class="text-nc-content-gray-subtle2 whitespace-break-spaces text-bodyDefaultSm line-clamp-2">
      {{ widget.description }}
    </div>
    <div
      :style="{
        color: colors.color,
      }"
      :class="{
        'flex-1 bg-nc-bg-gray-extralight rounded-md': widget.error,
      }"
      class="text-nc-content-gray-subtle2 truncate text-heading2"
    >
      <template v-if="widget.error">
        <div class="flex items-center justify-center h-full">
          <SmartsheetDashboardWidgetsCommonWidgetsError />
        </div>
      </template>
      <template v-else-if="isLoading"> _ </template>
      <template v-else>
        {{ widgetData?.data ?? '0' }}
      </template>
    </div>
  </div>
</template>
