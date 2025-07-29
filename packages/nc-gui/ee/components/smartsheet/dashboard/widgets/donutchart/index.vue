<script setup lang="ts">
import type { ChartTypes, ChartWidgetType } from 'nocodb-sdk'
import { CHART_COLORS } from '~/lib/constants'
import { truncateText } from '~/utils/stringUtils'

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

const chartConfig = computed(() => {
  return widgetRef.value?.config
})

const widgetSize = computed(() => {
  return widgetRef.value?.position?.h === 5 ? 'small' : 'medium'
})

const chartSize = computed(() => {
  const sizeMap = {
    small: { height: widgetRef?.value?.description ? '330px' : '368px', outerRadius: '80%', innerRadius: '50%' }, // 120 chart radius
    medium: { height: widgetRef?.value?.description ? '416px' : '456px', outerRadius: '80%', innerRadius: '50%' },
  }
  return sizeMap[widgetSize.value]
})

const legendConfig = computed(() => {
  const position = chartConfig.value?.appearance?.legendPosition ?? 'right'
  const showCountInLegend = chartConfig.value?.appearance?.showCountInLegend ?? true

  if (position === 'none') {
    return { show: false, orient: 'horizontal', top: '10%', left: 'center' }
  }

  const positionMap = {
    top: { orient: 'horizontal', top: '0%', left: 'center' },
    bottom: { orient: 'horizontal', bottom: '0%', left: 'center' },
    left: { orient: 'vertical', left: '10%', top: 'center' },
    right: { orient: 'vertical', right: '10%', top: 'center' },
  }

  return {
    show: true,
    ...positionMap[position],
    formatter: showCountInLegend
      ? (name: string) => {
          const item = widgetData.value?.data?.find((d: any) => d.name === name)
          if (item) {
            const displayValue = item.formatted_value !== undefined ? item.formatted_value : item.value
            const truncatedName = truncateText(name, 30)
            return `${truncatedName}: ${displayValue}`
          }
          return truncateText(name, 30)
        }
      : (name: string) => truncateText(name, 40),
    textStyle: {
      fontSize: 12,
      color: '#666',
    },
    itemGap: 15,
  }
})

const chartOption = computed<ECOption>(() => {
  if (!widgetData.value?.data || widgetData.value.data.length === 0) {
    return {}
  }

  const showPercentageOnChart = chartConfig.value?.appearance?.showPercentageOnChart ?? true

  const position = chartConfig.value?.appearance?.legendPosition ?? 'right'

  const centerConfig = {
    small: {
      top: ['50%', '60%'],
      bottom: ['50%', '40%'],
      left: ['70%', '50%'],
      right: ['30%', '50%'],
    },
    medium: {
      top: ['50%', '60%'],
      bottom: ['50%', '40%'],
      left: ['70%', '50%'],
      right: ['30%', '50%'],
    },
  }

  return {
    colors: CHART_COLORS,
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const dataItem = widgetData.value?.data?.find((d: any) => d.name === params.name)
        if (dataItem) {
          // Use formatted_value if available, otherwise use value
          const displayValue = dataItem.formatted_value !== undefined ? dataItem.formatted_value : dataItem.value
          return `${params.name} <br/>${displayValue} (${params.percent}%)`
        }
        return `${params.seriesName} <br/>${params.name}: ${params.value} (${params.percent}%)`
      },
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      textStyle: {
        color: '#fff',
      },
      borderWidth: 0,
      borderRadius: 6,
    },
    legend: legendConfig.value,
    series: [
      {
        name: widgetRef.value?.title || 'Data',
        type: 'pie',
        radius: [chartSize.value.innerRadius, chartSize.value.outerRadius],
        center:
          legendConfig.value.show && centerConfig[widgetSize.value][position]
            ? centerConfig[widgetSize.value][position]
            : ['50%', '50%'],
        data: widgetData.value.data,
        label: {
          show: showPercentageOnChart,
          formatter: showPercentageOnChart ? '{d}%' : '',
          position: 'inside',
          fontSize: 13,
          color: '#fff',
        },
        labelLine: {
          show: true,
        },
        avoidLabelOverlap: true,
      },
    ],
  }
})

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
      <VChart v-else class="chart" :style="{ height: chartSize.height }" :option="chartOption" autoresize />
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
