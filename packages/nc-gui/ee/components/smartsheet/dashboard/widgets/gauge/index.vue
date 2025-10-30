<script setup lang="ts">
import type { GaugeRange, GaugeWidgetType } from 'nocodb-sdk'

interface Props {
  widget: GaugeWidgetType
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const widgetRef = toRef(props, 'widget')

const widgetStore = useWidgetStore()
const widgetData = ref<any>(null)
const isLoading = ref(false)

const gaugeRanges = computed<GaugeRange[]>(() => {
  return widgetRef.value?.config?.appearance?.ranges || []
})

const minValue = computed(() => {
  if (gaugeRanges.value.length > 0) {
    return Math.min(...gaugeRanges.value.map((r) => r.min))
  }
  return 0
})

const maxValue = computed(() => {
  if (gaugeRanges.value.length > 0) {
    return Math.max(...gaugeRanges.value.map((r) => r.max))
  }
  return 100
})

const backgroundColor = computed(() => {
  const type = (widgetRef.value?.config.appearance as any)?.type ?? 'default'
  if (type === 'filled' || type === 'coloured') {
    return 'var(--nc-bg-default)'
  }
  return 'var(--nc-bg-default)'
})

const gaugeValue = computed(() => {
  return widgetData.value?.data?.value ?? 0
})

const showValue = computed(() => {
  return widgetRef.value?.config.appearance?.showValue ?? true
})

async function loadData() {
  if (!widgetRef.value?.id || widgetRef.value?.error) return
  isLoading.value = true

  widgetData.value = await widgetStore.loadWidgetData(widgetRef.value.id)
  isLoading.value = false
}

// Gauge configuration
const size = 200
const strokeWidth = 20
const radius = (size - strokeWidth) / 2
const angle = 180
const startAngle = -90

// Normalize value to 0-1 range
const normalizedValue = computed(() => {
  return Math.max(0, Math.min(1, (gaugeValue.value - minValue.value) / (maxValue.value - minValue.value)))
})

// Find the current range for the needle color
const needleColor = computed(() => {
  const currentRange = gaugeRanges.value.find(
    (range) => gaugeValue.value >= range.min && gaugeValue.value <= range.max,
  )
  return currentRange?.color || '#999'
})

// Calculate needle rotation (0 to 180 degrees)
const needleRotation = computed(() => {
  return normalizedValue.value * angle
})

// Background arc path
const backgroundArcPath = computed(() => {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = ((startAngle + angle) * Math.PI) / 180
  const startX = size / 2 + radius * Math.cos(startRad)
  const startY = size / 2 + radius * Math.sin(startRad)
  const endX = size / 2 + radius * Math.cos(endRad)
  const endY = size / 2 + radius * Math.sin(endRad)
  return `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${endX} ${endY}`
})

// Create range arcs
const rangeArcs = computed(() => {
  return gaugeRanges.value.map((range) => {
    const rangeMin = Math.max(range.min, minValue.value)
    const rangeMax = Math.min(range.max, maxValue.value)

    const startNorm = (rangeMin - minValue.value) / (maxValue.value - minValue.value)
    const endNorm = (rangeMax - minValue.value) / (maxValue.value - minValue.value)

    const startAngleRange = startAngle + startNorm * angle
    const endAngleRange = startAngle + endNorm * angle

    const startRadRange = (startAngleRange * Math.PI) / 180
    const endRadRange = (endAngleRange * Math.PI) / 180

    const startXRange = size / 2 + radius * Math.cos(startRadRange)
    const startYRange = size / 2 + radius * Math.sin(startRadRange)
    const endXRange = size / 2 + radius * Math.cos(endRadRange)
    const endYRange = size / 2 + radius * Math.sin(endRadRange)

    const largeArc = endNorm - startNorm > 0.5 ? 1 : 0

    return {
      range,
      path: `M ${startXRange} ${startYRange} A ${radius} ${radius} 0 ${largeArc} 1 ${endXRange} ${endYRange}`,
    }
  })
})

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
    class="nc-gauge-widget !rounded-xl h-full w-full p-4 flex group flex-col gap-1 relative"
    :style="{
      backgroundColor,
    }"
  >
    <div
      :class="{
        'mb-1.5': widget.description,
        'mb-3': !widget.description,
      }"
      class="flex items-center"
    >
      <div class="text-nc-content-gray-emphasis flex-1 truncate pr-1 text-subHeading2">
        {{ widget.title }}
      </div>
      <SmartsheetDashboardWidgetsCommonContext v-if="isEditing" :widget="widget" />
    </div>
    <div v-if="widget.description" class="text-nc-content-gray-subtle2 whitespace-break-spaces text-bodyDefaultSm line-clamp-2">
      {{ widget.description }}
    </div>
    <div
      :class="{
        'flex-1 bg-nc-bg-gray-extralight rounded-md': widget.error,
      }"
      class="flex flex-col items-center justify-center flex-1"
    >
      <template v-if="widget.error">
        <div class="flex items-center justify-center h-full">
          <SmartsheetDashboardWidgetsCommonWidgetsError />
        </div>
      </template>
      <template v-else-if="isLoading">
        <div class="text-nc-content-gray-subtle2">Loading...</div>
      </template>
      <template v-else>
        <div class="flex flex-col items-center justify-center gap-2 h-full w-full">
          <svg
            :width="size"
            :height="size / 2 + 20"
            :viewBox="`0 0 ${size} ${size / 2 + 20}`"
            class="drop-shadow-lg w-full"
            style="max-width: 100%"
          >
            <!-- Background arc -->
            <path :d="backgroundArcPath" fill="none" stroke="#e5e7eb" :stroke-width="strokeWidth" stroke-linecap="round" />

            <!-- Range arcs -->
            <path
              v-for="(arc, index) in rangeArcs"
              :key="index"
              :d="arc.path"
              fill="none"
              :stroke="arc.range.color"
              :stroke-width="strokeWidth"
              stroke-linecap="round"
              opacity="0.8"
            />

            <!-- Needle -->
            <g :transform="`translate(${size / 2}, ${size / 2}) rotate(${needleRotation - 90})`">
              <line
                x1="0"
                y1="0"
                :x2="radius - strokeWidth / 2"
                y2="0"
                :stroke="needleColor"
                :stroke-width="strokeWidth / 2"
                stroke-linecap="round"
              />
              <circle cx="0" cy="0" :r="strokeWidth / 1.5" :fill="needleColor" />
            </g>

            <!-- Center circle -->
            <circle :cx="size / 2" :cy="size / 2" :r="strokeWidth / 1.2" fill="white" :stroke="needleColor" stroke-width="2" />
          </svg>

          <!-- Value display -->
          <div v-if="showValue" class="text-center -mt-2">
            <p class="text-xl font-bold text-gray-700">
              {{ Intl.NumberFormat('en-US').format(gaugeValue) }}
            </p>
          </div>

          <!-- Range legend -->
          <div v-if="gaugeRanges.length > 0" class="flex flex-wrap gap-2 justify-center px-2">
            <div v-for="(range, index) in gaugeRanges" :key="index" class="flex items-center gap-1.5">
              <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: range.color }" />
              <span class="text-xs text-gray-600">{{ range.label || `${range.min}-${range.max}` }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-gauge-widget {
  transition: background-color 0.3s ease;
}
</style>
