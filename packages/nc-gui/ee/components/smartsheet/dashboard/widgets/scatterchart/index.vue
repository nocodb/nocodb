<script setup lang="ts">
import type { ChartTypes, ChartWidgetType } from 'nocodb-sdk'
import { CHART_COLORS } from '~/lib/constants'
import { truncateText } from '~/utils/stringUtils'

interface Props {
  widget: ChartWidgetType<ChartTypes.SCATTER>
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
    small: { height: widgetRef?.value?.description ? '390px' : '420px' },
    medium: { height: widgetRef?.value?.description ? '480px' : '520px' },
  }
  return sizeMap[widgetSize.value]
})

const disableLegend = computed(() => widgetRef.value?.config?.data?.yAxis?.fields?.length < 2)

const legendConfig = computed(() => {
  if (disableLegend.value) return { show: false }
  const position = chartConfig.value?.appearance?.legendPosition ?? 'top'
  const showCountInLegend = chartConfig.value?.appearance?.showCountInLegend ?? true

  if (position === 'none') {
    return { show: false }
  }

  const positionMap = {
    top: { orient: 'horizontal', top: '0%', left: 'center' },
    bottom: { orient: 'horizontal', bottom: '8%', left: 'center' },
    left: { orient: 'vertical', left: '0%', top: 'center' },
    right: { orient: 'vertical', right: '0%', top: 'center' },
  }

  return {
    show: true,
    ...positionMap[position],
    formatter: showCountInLegend
      ? (name: string) => {
          // Find the series data to show aggregated value
          const seriesData = widgetData.value?.series?.find((s: any) => s.name === name)
          if (seriesData && Array.isArray(seriesData.data)) {
            const total = seriesData.data.reduce((sum: number, item: any) => {
              const value = typeof item === 'object' ? item.value || 0 : item
              return sum + value
            }, 0)
            const truncatedName = truncateText(name, 25)
            return `${truncatedName}: ${total}`
          }
          return truncateText(name, 30)
        }
      : (name: string) => truncateText(name, 35),
    textStyle: {
      fontSize: 11,
      color: '#666',
    },
    itemGap: 12,
  }
})

const gridConfig = computed(() => {
  const legendPosition = chartConfig.value?.appearance?.legendPosition ?? 'top'
  const hasLegend = legendPosition !== 'none' && !disableLegend.value

  const baseConfig = {
    left: '5%',
    right: '5%',
    top: '10%',
    bottom: '10%',
    containLabel: true,
  }

  if (hasLegend) {
    switch (legendPosition) {
      case 'top':
        baseConfig.top = '15%'
        break
      case 'bottom':
        baseConfig.bottom = '15%'
        break
      case 'left':
        baseConfig.left = '20%'
        break
      case 'right':
        baseConfig.right = '20%'
        break
    }
  }

  return baseConfig
})

const chartOption = computed<ECOption>(() => {
  if (!widgetData.value?.categories || !widgetData.value?.series) {
    return {}
  }

  const showValueInChart = chartConfig.value?.appearance?.showValueInChart ?? false
  const startAtZero = chartConfig.value?.data?.yAxis?.startAtZero ?? true

  return {
    color: CHART_COLORS,
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const categoryName = params.data.name
        const value = params.data?.formatted_value !== undefined ? params.data.formatted_value : params.value[1]
        return `<strong>${categoryName}</strong><br/>${params.marker}${params.seriesName}: ${value}`
      },
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      textStyle: {
        color: '#fff',
      },
      borderWidth: 0,
      borderRadius: 6,
    },
    legend: legendConfig.value,
    grid: gridConfig.value,
    xAxis: {
      type: 'category',
      data: widgetData.value.categories.map((cat: string) => truncateText(cat, 20)),
      axisLabel: {
        fontSize: 11,
        color: '#666',
        rotate: widgetData.value.categories.some((cat: string) => cat.length > 15) ? 45 : 0,
      },
      axisLine: {
        lineStyle: {
          color: '#e5e7eb',
        },
      },
      axisTick: {
        lineStyle: {
          color: '#e5e7eb',
        },
      },
    },
    yAxis: {
      type: 'value',
      min: startAtZero ? 0 : 'dataMin',
      axisLabel: {
        fontSize: 11,
        color: '#666',
        formatter: (value: number) => {
          // Format large numbers
          if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`
          } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`
          }
          return value.toString()
        },
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          type: 'dashed',
        },
      },
    },
    series: widgetData.value.series.map((series: any) => ({
      name: series.name,
      type: 'line',
      data: series.data,
      itemStyle: {
        borderWidth: 2,
      },
      symbol: 'circle',
      symbolSize: 6,
      emphasis: {
        itemStyle: {
          borderWidth: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
        },
        lineStyle: {
          width: 3,
        },
      },
      label: {
        show: showValueInChart && widgetData.value.series.length === 1,
        position: 'top',
        fontSize: 10,
        color: '#666',
        formatter: (params: any) => {
          const value = params.data?.formatted_value !== undefined ? params.data.formatted_value : params.value
          return value
        },
      },
    })),
    animation: {
      duration: 750,
      easing: 'cubicOut',
    },
  }
})

async function loadData() {
  if (!widgetRef.value?.id || widgetRef.value?.error) return

  isLoading.value = true
  try {
    const rawData = await widgetStore.loadWidgetData(widgetRef.value.id)

    if (rawData?.categories && rawData?.series && Array.isArray(rawData.series)) {
      widgetData.value = rawData
    } else {
      widgetData.value = { categories: [], series: [] }
    }
  } catch (error) {
    console.error('Failed to load chart data:', error)
    widgetData.value = { categories: [], series: [] }
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
  <div class="nc-scatter-chart-widget h-full w-full flex flex-col relative bg-white !rounded-xl">
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
        v-else-if="!widgetData?.categories?.length || !widgetData?.series?.length"
        class="flex items-center justify-center h-full text-nc-content-gray-subtle2"
      >
        <div class="text-center">
          <div class="text-4xl mb-2">📈</div>
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
