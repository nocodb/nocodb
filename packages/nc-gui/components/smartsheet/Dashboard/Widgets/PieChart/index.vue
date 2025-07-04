<script setup lang="ts">
import { ChartTypes } from 'nocodb-sdk'
import type { ChartWidgetType } from 'nocodb-sdk'

interface Props {
  widget: ChartWidgetType<ChartTypes.PIE>
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

const chartSize = computed(() => {
  const size = chartConfig.value?.appearance?.size ?? 'medium'
  const sizeMap = {
    small: { height: '250px', radius: '45%' },
    medium: { height: '350px', radius: '60%' },
    large: { height: '450px', radius: '70%' },
  }
  return sizeMap[size]
})

const legendConfig = computed(() => {
  const position = chartConfig.value?.appearance?.legendPosition ?? 'right'
  const showCountInLegend = chartConfig.value?.appearance?.showCountInLegend ?? true

  if (position === 'none') {
    return { show: false }
  }

  const positionMap = {
    top: { orient: 'horizontal', top: '10%', left: 'center' },
    bottom: { orient: 'horizontal', bottom: '10%', left: 'center' },
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
            return `${name}: ${displayValue}`
          }
          return name
        }
      : undefined,
    textStyle: {
      fontSize: 12,
      color: '#666',
    },
    itemGap: 15,
  }
})

const chartColors = computed(() => {
  const colorSchema = chartConfig.value?.appearance?.colorSchema ?? 'default'

  if (colorSchema === 'custom' && chartConfig.value?.appearance?.customColorSchema) {
    return chartConfig.value.appearance.customColorSchema.map((c) => c.color)
  }

  return ['#4CAF50', '#FF9800', '#9C27B0', '#2196F3', '#F44336', '#00BCD4', '#FFEB3B', '#795548']
})

const chartOption = computed<ECOption>(() => {
  if (!widgetData.value?.data || widgetData.value.data.length === 0) {
    return {}
  }

  const showPercentageOnChart = chartConfig.value?.appearance?.showPercentageOnChart ?? false

  return {
    color: chartColors.value,
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const dataItem = widgetData.value?.data?.find((d: any) => d.name === params.name)
        if (dataItem) {
          // Use formatted_value if available, otherwise use value
          const displayValue = dataItem.formatted_value !== undefined ? dataItem.formatted_value : dataItem.value
          return `${params.seriesName} <br/>${params.name}: ${displayValue} (${params.percent}%)`
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
        radius: chartSize.value.radius,
        center: legendConfig.value.show && legendConfig.value.orient === 'vertical' ? ['40%', '50%'] : ['50%', '50%'],
        data: widgetData.value.data,
        emphasis: {
          itemStyle: {
            shadowBlur: 15,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            borderWidth: 2,
            borderColor: '#fff',
          },
        },
        label: {
          show: showPercentageOnChart,
          formatter: showPercentageOnChart ? '{d}%' : '',
          position: 'inside',
          fontSize: 12,
          fontWeight: 'bold',
          color: '#fff',
        },
        labelLine: {
          show: false,
        },
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDuration: 1000,
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

watch(
  () => widgetRef.value?.config,
  () => {
    loadData()
  },
  { deep: true },
)
</script>

<template>
  <div class="nc-pie-chart-widget h-full w-full flex flex-col relative bg-white rounded-lg">
    <div class="flex items-center justify-between p-4 pb-2">
      <div class="flex-1">
        <h3 class="text-nc-content-gray-emphasis text-subHeading2 font-medium">
          {{ widget.title }}
        </h3>
        <p v-if="widget.description" class="text-nc-content-gray-subtle2 text-bodyDefaultSm mt-1">
          {{ widget.description }}
        </p>
      </div>
      <SmartsheetDashboardWidgetsCommonContext v-if="isEditing" :widget="widget" />
    </div>

    <div class="flex-1 p-4 pt-0">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
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
.nc-pie-chart-widget {
  border: 1px solid var(--nc-border-color-light);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--nc-border-color-medium);
  }

  .chart {
    width: 100%;
  }
}

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
