<script setup lang="ts">
import type { ChartTypes, ChartWidgetType } from 'nocodb-sdk'

interface Props {
  widget: ChartWidgetType<ChartTypes.DONUT>
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const widgetRef = toRef(props, 'widget')

const widgetStore = useWidgetStore()
const widgetData = ref<any>(null)
const isLoading = ref(false)

const widgetEl = ref<HTMLElement | null>(null)
const { width: widgetWidth } = useElementSize(widgetEl)

const { chartOption } = useDashboardPieChartOption(widgetRef, widgetData, { isDonut: true, widgetWidth })

async function loadData() {
  if (!widgetRef.value?.id) return

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

watch(
  [() => widgetRef.value?.config?.dataSource, () => widgetRef.value?.config?.data, () => widgetRef.value?.filters],
  () => {
    loadData()
  },
  {
    deep: true,
  },
)
</script>

<template>
  <div ref="widgetEl" class="nc-donut-chart-widget h-full w-full flex flex-col relative bg-nc-bg-default !rounded-xl">
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

    <div class="flex-1 min-h-0 p-4 pt-0">
      <SmartsheetDashboardWidgetsCommonChartStates
        :is-loading="isLoading"
        :is-error="!!widgetRef.error"
        :is-empty="!widgetData?.data || widgetData.data.length === 0"
      >
        <VChart class="chart h-full w-full" :option="chartOption" autoresize />
      </SmartsheetDashboardWidgetsCommonChartStates>
    </div>
  </div>
</template>


