<script setup lang="ts">
import type { MetricWidgetConfig, WidgetType } from 'nocodb-sdk'
import dayjs from 'dayjs'

interface Props {
  widget?: WidgetType
  config?: MetricWidgetConfig
  isReadonly?: boolean
}

const props = defineProps<Props>()

const isLoading = ref(false)
const error = ref<string | null>(null)
const metricData = ref<any>(null)
const comparisonData = ref<any>(null)
const lastUpdated = ref<Date | null>(null)

// Load metric data
const loadMetricData = async () => {
  if (!props.config?.metric) return

  try {
    isLoading.value = true
    error.value = null

    // TODO: Implement actual data fetching based on config
    // This is a placeholder implementation

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock data for demonstration
    metricData.value = {
      value: Math.floor(Math.random() * 10000),
      aggregation: props.config.metric.aggregation,
    }

    if (props.config.comparison?.enabled) {
      comparisonData.value = {
        value: Math.floor(Math.random() * 10000),
        aggregation: props.config.metric.aggregation,
      }
    }

    lastUpdated.value = new Date()
  } catch (e) {
    console.error('Error loading metric data:', e)
    error.value = 'Failed to load metric data'
  } finally {
    isLoading.value = false
  }
}

// Computed values
const formattedValue = computed(() => {
  if (!metricData.value) return '—'

  const value = metricData.value.value
  return formatNumber(value)
})

const comparisonChange = computed(() => {
  if (!metricData.value || !comparisonData.value) return 0
  return metricData.value.value - comparisonData.value.value
})

const formattedComparison = computed(() => {
  if (!comparisonData.value) return ''

  const change = Math.abs(comparisonChange.value)
  const percentage = comparisonData.value.value ? Math.round((change / comparisonData.value.value) * 100) : 0

  return `${formatNumber(change)} (${percentage}%)`
})

const comparisonClass = computed(() => ({
  'text-green-600': comparisonChange.value > 0,
  'text-red-600': comparisonChange.value < 0,
  'text-gray-600': comparisonChange.value === 0,
}))

// Helper functions
const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

const formatDateTime = (date: Date) => {
  return dayjs(date).format('MMM D, YYYY HH:mm')
}

const getComparisonPeriodLabel = () => {
  switch (props.config?.comparison?.period) {
    case 'previous_period':
      return 'previous period'
    case 'previous_year':
      return 'previous year'
    case 'custom':
      return 'custom period'
    default:
      return 'previous period'
  }
}

// Load data when component mounts or config changes
watchEffect(() => {
  if (props.config?.metric) {
    loadMetricData()
  }
})
</script>

<template>
  <div class="metric-widget">
    <div v-if="isLoading" class="loading-state">
      <a-spin />
    </div>

    <div v-else-if="error" class="error-state">
      <MaterialSymbolsErrorRounded class="text-4xl text-red-400 mb-2" />
      <p class="text-red-500 text-sm">{{ error }}</p>
    </div>

    <div v-else-if="!config?.metric" class="no-config">
      <MaterialSymbolsAnalyticsRounded class="text-4xl text-gray-400 mb-2" />
      <p class="text-gray-500 text-sm">Metric not configured</p>
    </div>

    <div v-else class="metric-content">
      <!-- Main metric value -->
      <div class="metric-value">
        <div class="value">{{ formattedValue }}</div>
        <div v-if="config.metric.label" class="label">{{ config.metric.label }}</div>
      </div>

      <!-- Comparison (if enabled) -->
      <div v-if="config.comparison?.enabled && comparisonData" class="metric-comparison">
        <div class="comparison-value" :class="comparisonClass">
          <GeneralIcon v-if="comparisonChange > 0" icon="ncArrowUp" class="w-4 h-4" />
          <GeneralIcon v-else-if="comparisonChange < 0" icon="ncArrowDown" class="w-4 h-4" />
          <GeneralIcon v-else icon="ncArrowRight" class="w-4 h-4" />
          <span>{{ formattedComparison }}</span>
        </div>
        <div class="comparison-label">vs {{ getComparisonPeriodLabel() }}</div>
      </div>

      <!-- Additional info -->
      <div v-if="lastUpdated" class="last-updated">Last updated: {{ formatDateTime(lastUpdated) }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.metric-widget {
  @apply w-full h-full flex flex-col;
}

.loading-state,
.error-state,
.no-config {
  @apply w-full h-full flex flex-col items-center justify-center;
}

.metric-content {
  @apply flex flex-col h-full justify-center;
}

.metric-value {
  @apply text-center mb-4;

  .value {
    @apply text-3xl font-bold text-gray-900 mb-1;
    line-height: 1.2;
  }

  .label {
    @apply text-sm text-gray-600 uppercase tracking-wide;
  }
}

.metric-comparison {
  @apply text-center mb-4;

  .comparison-value {
    @apply flex items-center justify-center gap-1 text-sm font-medium mb-1;
  }

  .comparison-label {
    @apply text-xs text-gray-500;
  }
}

.last-updated {
  @apply text-xs text-gray-400 text-center mt-auto;
}
</style>
