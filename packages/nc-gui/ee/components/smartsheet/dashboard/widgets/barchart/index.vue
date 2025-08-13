<script setup lang="ts">
import type { ChartTypes, ChartWidgetType } from 'nocodb-sdk'

interface Props {
  widget: ChartWidgetType<ChartTypes.BAR>
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const widgetRef = toRef(props, 'widget')

const widgetStore = useWidgetStore()
const widgetData = ref<any>(null)
const isLoading = ref(false)

async function loadData() {
  if (!widgetRef.value?.id || widgetRef.value?.error) return

  isLoading.value = true
  try {
    const rawData = await widgetStore.loadWidgetData(widgetRef.value.id)

    if (rawData?.data && Array.isArray(rawData.data)) {
      widgetData.value = rawData
    } else {
      widgetData.value = { data: [] }
    }
  } catch (error) {
    console.error('Failed to load chart data:', error)
    widgetData.value = { data: [] }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch([() => widgetRef.value?.config?.dataSource, () => widgetRef.value?.config?.data], () => {
  loadData()
})
</script>

<template>
  <div class="nc-pie-chart-widget h-full w-full flex flex-col relative bg-white !rounded-xl">
    <div class="flex flex-col p-4 pb-3">
      <div class="flex items-center">
        <div class="text-nc-content-gray-emphasis flex-1 text-subHeading2 truncate font-medium">
          {{ widget.title }}
        </div>
        <SmartsheetDashboardWidgetsCommonContext v-if="isEditing" :widget="widget" />
      </div>

      <div
        v-if="widget.description"
        class="text-nc-content-gray-subtle2 whitespace-break-spaces line-clamp-2 text-bodyDefaultSm mt-1"
      >
        {{ widget.description }}
      </div>
    </div>

    <div class="flex-1 p-4 pt-0">
      <div
        v-if="widgetRef.error"
        :class="{
          'bg-nc-bg-gray-extralight flex items-center justify-center h-full rounded-md': widgetRef.error,
        }"
      >
        <SmartsheetDashboardWidgetsCommonWidgetsError />
      </div>
      <div v-else-if="isLoading" class="flex items-center justify-center h-full">
        <div class="flex items-center gap-2 text-nc-content-gray-subtle2">
          <div class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
          Loading chart data...
        </div>
      </div>

      <div
        v-else-if="!widgetData?.data || widgetData.data.length === 0"
        class="flex items-center justify-center h-full text-nc-content-gray-subtle2"
      >
        <div class="text-center">
          <div class="text-4xl mb-2">📊</div>
          <div class="text-bodyDefaultSm">No data available</div>
        </div>
      </div>
      <!--
      <VChart v-else class="chart" :style="{ height: chartSize.height }" :option="chartOption" autoresize />
-->
    </div>
  </div>
</template>

<style scoped lang="scss">
// Loading animation
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
