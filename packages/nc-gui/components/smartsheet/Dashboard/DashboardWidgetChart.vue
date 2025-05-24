<script setup lang="ts">
import type { ChartWidgetConfig, WidgetType } from 'nocodb-sdk'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line, Pie, Scatter } from 'vue-chartjs'

const props = defineProps<Props>()

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler)

interface Props {
  widget?: WidgetType
  config?: ChartWidgetConfig
  isReadonly?: boolean
}

const isLoading = ref(false)
const error = ref<string | null>(null)
const chartData = ref<any>(null)

// Chart component mapping
const chartComponent = computed(() => {
  switch (props.config?.chartType) {
    case 'bar':
      return Bar
    case 'line':
    case 'area':
      return Line
    case 'pie':
      return Pie
    case 'doughnut':
      return Doughnut
    case 'scatter':
      return Scatter
    default:
      return Bar
  }
})

// Chart options
const chartOptions = computed(() => {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        cornerRadius: 8,
      },
    },
    scales: {},
  }

  // Configure scales based on chart type
  if (['bar', 'line', 'area', 'scatter'].includes(props.config?.chartType || '')) {
    baseOptions.scales = {
      x: {
        title: {
          display: !!props.config?.xAxis?.label,
          text: props.config?.xAxis?.label || '',
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        title: {
          display: !!props.config?.yAxis?.[0]?.label,
          text: props.config?.yAxis?.[0]?.label || '',
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    }
  }

  // Area chart specific options
  if (props.config?.chartType === 'area') {
    baseOptions.plugins = {
      ...baseOptions.plugins,
      filler: {
        propagate: false,
      },
    }
  }

  return baseOptions
})

// Load chart data
const loadChartData = async () => {
  if (!props.config?.chartType) return

  try {
    isLoading.value = true
    error.value = null

    // TODO: Implement actual data fetching based on config
    // This is a placeholder implementation

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Generate mock data based on chart type
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const data = Array.from({ length: 6 }, () => Math.floor(Math.random() * 100))

    if (['pie', 'doughnut'].includes(props.config.chartType)) {
      chartData.value = {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple'],
        datasets: [
          {
            data: Array.from({ length: 5 }, () => Math.floor(Math.random() * 100)),
            backgroundColor: ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#a855f7'],
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      }
    } else if (props.config.chartType === 'scatter') {
      chartData.value = {
        datasets: [
          {
            label: 'Scatter Dataset',
            data: Array.from({ length: 20 }, () => ({
              x: Math.random() * 100,
              y: Math.random() * 100,
            })),
            backgroundColor: '#3b82f6',
            borderColor: '#3b82f6',
          },
        ],
      }
    } else {
      const dataset = {
        label: props.config.yAxis?.[0]?.label || 'Data',
        data,
        borderColor: '#3b82f6',
        backgroundColor: props.config.chartType === 'area' ? 'rgba(59, 130, 246, 0.2)' : '#3b82f6',
        tension: props.config.chartType === 'line' ? 0.4 : 0,
        fill: props.config.chartType === 'area',
      }

      chartData.value = {
        labels,
        datasets: [dataset],
      }
    }
  } catch (e) {
    console.error('Error loading chart data:', e)
    error.value = 'Failed to load chart data'
  } finally {
    isLoading.value = false
  }
}

// Load data when component mounts or config changes
watchEffect(() => {
  if (props.config?.chartType) {
    loadChartData()
  }
})
</script>

<template>
  <div class="chart-widget">
    <div v-if="isLoading" class="loading-state">
      <a-spin size="large" />
      <p class="text-gray-500 text-sm mt-2">Loading chart data...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <GeneralIcon icon="ncBarChart2" class="text-4xl text-red-400 mb-2" />
      <p class="text-red-500 text-sm">{{ error }}</p>
    </div>

    <div v-else-if="!config?.chartType" class="no-config">
      <GeneralIcon icon="ncBarChart2" class="text-4xl text-gray-400 mb-2" />

      <p class="text-gray-500 text-sm">Chart not configured</p>
    </div>

    <div v-else class="chart-container">
      <component :is="chartComponent" :data="chartData" :options="chartOptions" class="chart-canvas" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.chart-widget {
  @apply w-full h-full;
}

.loading-state,
.error-state,
.no-config {
  @apply w-full h-full flex flex-col items-center justify-center;
}

.chart-container {
  @apply w-full h-full relative;
  min-height: 200px;
}

.chart-canvas {
  @apply w-full h-full;
}
</style>
