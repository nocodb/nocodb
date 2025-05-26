<script setup lang="ts">
import type { WidgetType } from 'nocodb-sdk'

interface Props {
  widget: WidgetType
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

// Extract config from widget
const config = computed(() => props.widget.config || {})
const appearance = computed(() => config.value.appearance || {})
const display = computed(() => config.value.display || {})
const source = computed(() => config.value.source || {})
const component = computed(() => config.value.component || {})

// Mock data for now - will be replaced with actual data fetching
const getWidgetData = () => {
  // Use config to determine what data to show
  const aggregationType = source.value.aggregation || 'count'
  const title = component.value.title || 'Number Widget'

  // Generate different mock data based on widget configuration
  switch (aggregationType) {
    case 'count':
      return {
        value: Math.floor(Math.random() * 1000) + 100,
        previousValue: Math.floor(Math.random() * 800) + 80,
        label: title,
      }
    case 'sum':
      return {
        value: Math.floor(Math.random() * 50000) + 10000,
        previousValue: Math.floor(Math.random() * 40000) + 8000,
        label: title,
      }
    case 'avg':
      return {
        value: Math.floor(Math.random() * 100) + 20,
        previousValue: Math.floor(Math.random() * 80) + 15,
        label: title,
      }
    default:
      return {
        value: Math.floor(Math.random() * 1000) + 100,
        previousValue: Math.floor(Math.random() * 800) + 80,
        label: title,
      }
  }
}

const widgetData = ref(getWidgetData())

// Update data when source configuration changes
watch(
  [source, component],
  () => {
    widgetData.value = getWidgetData()
  },
  { deep: true },
)

// Calculate percentage change
const percentageChange = computed(() => {
  if (!widgetData.value.previousValue || widgetData.value.previousValue === 0) return 0
  return ((widgetData.value.value - widgetData.value.previousValue) / widgetData.value.previousValue) * 100
})

const isPositiveChange = computed(() => percentageChange.value >= 0)

// Color configuration
const getTextColor = computed(() => {
  if (appearance.value.textColor) {
    return appearance.value.textColor
  }
  return 'var(--nc-content-gray-800)'
})

const getBackgroundColor = computed(() => {
  if (appearance.value.backgroundColor) {
    return appearance.value.backgroundColor
  }
  return 'transparent'
})
</script>

<template>
  <div
    class="nc-number-widget h-full w-full p-4 flex flex-col justify-center items-center relative"
    :style="{
      backgroundColor: getBackgroundColor,
      color: getTextColor,
    }"
  >
    <!-- Main Number Display -->
    <div class="text-center flex-1 flex flex-col justify-center">
      <!-- Value -->
      <div
        class="nc-number-value font-bold mb-2"
        :class="{
          'text-4xl': !appearance.fontSize || appearance.fontSize === 'large',
          'text-3xl': appearance.fontSize === 'medium',
          'text-2xl': appearance.fontSize === 'small',
        }"
      >
        {{ widgetData.value.toLocaleString() }}
      </div>

      <!-- Label -->
      <div v-if="display.showLabel !== false" class="nc-number-label text-nc-content-gray-600 text-sm font-medium">
        {{ widgetData.label }}
      </div>

      <!-- Comparison (if enabled) -->
      <div
        v-if="display.showComparison && widgetData.previousValue"
        class="nc-number-comparison flex items-center justify-center mt-2 text-xs"
        :class="{
          'text-green-600': isPositiveChange,
          'text-red-600': !isPositiveChange,
        }"
      >
        <GeneralIcon :icon="isPositiveChange ? 'trending-up' : 'trending-down'" class="w-3 h-3 mr-1" />
        {{ Math.abs(percentageChange).toFixed(1) }}%
      </div>
    </div>

    <!-- Edit overlay -->
    <div v-if="isEditing" class="absolute inset-0 bg-black bg-opacity-5 flex items-center justify-center">
      <GeneralIcon icon="edit" class="w-6 h-6 text-nc-content-gray-500" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-number-widget {
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.nc-number-value {
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.nc-number-label {
  line-height: 1.4;
}

.nc-number-comparison {
  font-weight: 500;
}
</style>
