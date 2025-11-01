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
  return (
    widgetRef.value?.config?.appearance?.ranges || [
      { color: '#FF6E76', min: 0, max: 33, label: 'Low' },
      { color: '#FDDD60', min: 33, max: 67, label: 'Medium' },
      { color: '#7CFFB2', min: 67, max: 100, label: 'High' },
    ]
  )
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

const size = 200
const strokeWidth = 15
const centerX = size / 2
const centerY = size / 2
const radius = (size - strokeWidth) / 2

const gaugeStartAngle = -90 // Start at left (-90 degrees)
const gaugeEndAngle = 90 // End at right (90 degrees)
const totalGaugeAngle = gaugeEndAngle - gaugeStartAngle

// Normalize value to 0-1 range
const normalizedValue = computed(() => {
  if (maxValue.value === minValue.value) return 0
  return Math.max(0, Math.min(1, (gaugeValue.value - minValue.value) / (maxValue.value - minValue.value)))
})

// Find the current range for the needle color
const needleColor = computed(() => {
  const currentRange = gaugeRanges.value.find((range) => gaugeValue.value >= range.min && gaugeValue.value < range.max)
  // Handle edge case where value equals the max of the last range
  const lastRange = gaugeRanges.value[gaugeRanges.value.length - 1]
  if (!currentRange && lastRange && gaugeValue.value === lastRange.max) {
    return lastRange.color
  }
  return currentRange?.color || '#999'
})

const needleAngle = computed(() => {
  return gaugeStartAngle + normalizedValue.value * totalGaugeAngle
})

// Helper function to convert angle to coordinates
const angleToCoords = (angle: number, r: number) => {
  const rad = (angle * Math.PI) / 180
  // Adjust so 0 degrees is at top, 90 is right, 180 is bottom
  const adjustedRad = rad - Math.PI / 2
  return {
    x: centerX + r * Math.cos(adjustedRad),
    y: centerY + r * Math.sin(adjustedRad),
  }
}

// Background arc coordinates
const startCoords = computed(() => angleToCoords(gaugeStartAngle, radius))
const endCoords = computed(() => angleToCoords(gaugeEndAngle, radius))

// Background arc path
const backgroundArcPath = computed(() => {
  const start = startCoords.value
  const end = endCoords.value
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`
})

// Create range arcs with no overlap
const rangeArcs = computed(() => {
  return gaugeRanges.value.map((range) => {
    const rangeMin = Math.max(range.min, minValue.value)
    const rangeMax = Math.min(range.max, maxValue.value)

    // Calculate angles for this range
    let rangeStartNorm = 0
    let rangeEndNorm = 0
    if (maxValue.value !== minValue.value) {
      rangeStartNorm = (rangeMin - minValue.value) / (maxValue.value - minValue.value)
      rangeEndNorm = (rangeMax - minValue.value) / (maxValue.value - minValue.value)
    }

    const rangeStartAngle = gaugeStartAngle + rangeStartNorm * totalGaugeAngle
    const rangeEndAngle = gaugeStartAngle + rangeEndNorm * totalGaugeAngle

    const rangeStartCoords = angleToCoords(rangeStartAngle, radius)
    const rangeEndCoords = angleToCoords(rangeEndAngle, radius)

    const angleSpan = rangeEndAngle - rangeStartAngle
    const largeArc = angleSpan > 90 ? 1 : 0

    return {
      range,
      path: `M ${rangeStartCoords.x} ${rangeStartCoords.y} A ${radius} ${radius} 0 ${largeArc} 1 ${rangeEndCoords.x} ${rangeEndCoords.y}`,
    }
  })
})

// Needle coordinates
const needleEndCoords = computed(() => {
  const needleLength = radius - strokeWidth / 2
  return angleToCoords(needleAngle.value, needleLength)
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
  <div class="nc-gauge-widget !rounded-xl h-full w-full p-4 flex group flex-col gap-1 relative">
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
          <svg :width="size" :height="120" :viewBox="`0 0 ${size} 120`" class="drop-shadow-lg w-full" style="max-width: 100%">
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
            <line
              :x1="centerX"
              :y1="centerY"
              :x2="needleEndCoords.x"
              :y2="needleEndCoords.y"
              :stroke="needleColor"
              :stroke-width="strokeWidth / 2"
              stroke-linecap="round"
            />

            <!-- Center circle -->
            <circle :cx="centerX" :cy="centerY" :r="strokeWidth / 1.2" fill="white" :stroke="needleColor" stroke-width="2" />
          </svg>

          <!-- Value display -->
          <div v-if="showValue" class="text-center text-xl font-bold text-gray-700">
            {{ Intl.NumberFormat().format(gaugeValue) }}
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
