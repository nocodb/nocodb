<script setup lang="ts">
import type { GaugeWidgetType } from 'nocodb-sdk'
import { colorColoured, colorFilled } from './config/color'

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

const colors = computed(() => {
  const type = (widgetRef.value?.config.appearance as any)?.type ?? 'default'
  if (type === 'filled') {
    return colorFilled.find((c) => c.id === (widgetRef.value?.config.appearance as any)?.theme) ?? colorFilled[0]
  } else if (type === 'coloured') {
    return colorColoured.find((c) => c.id === (widgetRef.value?.config.appearance as any)?.theme) ?? colorColoured[0]
  }

  return {
    fill: 'var(--nc-bg-default)',
    color: 'var(--nc-content-gray-subtle2)',
  }
})

const gaugePercentage = computed(() => {
  return widgetData.value?.data?.percentage ?? 0
})

const gaugeValue = computed(() => {
  return widgetData.value?.data?.value ?? 0
})

const showValue = computed(() => {
  return widgetRef.value?.config.appearance?.showValue ?? true
})

const showPercentage = computed(() => {
  return widgetRef.value?.config.appearance?.showPercentage ?? true
})

async function loadData() {
  if (!widgetRef.value?.id || widgetRef.value?.error) return
  isLoading.value = true

  widgetData.value = await widgetStore.loadWidgetData(widgetRef.value.id)
  isLoading.value = false
}

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

// Gauge calculations using strokeDasharray approach
const radius = 100
const strokeWidth = 16
const innerRadius = radius - strokeWidth / 2

const circumference = computed(() => innerRadius * 2 * Math.PI)

// Using 270 degrees for the gauge arc (leaving 90 degrees gap at bottom)
const arcAngle = 270
const arc = computed(() => circumference.value * (arcAngle / 360))

const dashArray = computed(() => `${arc.value} ${circumference.value}`)

// Rotate 135 degrees to start from bottom left (matching the article)
const transform = `rotate(135, ${radius}, ${radius})`

const percentNormalized = computed(() => Math.min(Math.max(gaugePercentage.value, 0), 100))

const dashOffset = computed(() => arc.value - (percentNormalized.value / 100) * arc.value)
</script>

<template>
  <div
    class="nc-gauge-widget !rounded-xl h-full w-full p-4 flex group flex-col gap-1 relative"
    :style="{
      backgroundColor: colors?.fill,
    }"
  >
    <div
      :class="{
        'mb-1.5': widget.description,
        'mb-3': !widget.description,
      }"
      class="flex items-center"
    >
      <div
        :style="{
          color: colors?.color,
        }"
        class="text-nc-content-gray-emphasis flex-1 truncate pr-1 text-subHeading2"
      >
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
        <div class="relative w-full flex flex-col items-center justify-center">
          <svg viewBox="0 0 200 120" class="w-full" style="max-width: 240px; max-height: 140px">
            <!-- Background circle -->
            <circle
              :cx="radius"
              :cy="radius"
              :r="innerRadius"
              fill="transparent"
              :stroke="colors.fill === 'var(--nc-bg-default)' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.12)'"
              :stroke-width="strokeWidth"
              :stroke-dasharray="dashArray"
              stroke-linecap="round"
              :transform="transform"
            />
            <!-- Foreground circle (progress) -->
            <circle
              :cx="radius"
              :cy="radius"
              :r="innerRadius"
              fill="transparent"
              :stroke="colors.color"
              :stroke-width="strokeWidth"
              :stroke-dasharray="dashArray"
              :stroke-dashoffset="dashOffset"
              stroke-linecap="round"
              :transform="transform"
              class="gauge-progress"
            />
          </svg>
          <div class="text-center -mt-16">
            <div v-if="showValue" :style="{ color: colors.color }" class="text-heading1 font-bold leading-tight">
              {{ gaugeValue }}
            </div>
            <div v-if="showPercentage" :style="{ color: colors.color }" class="text-bodyDefaultSm opacity-80 mt-1">
              {{ Math.round(gaugePercentage) }}%
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.gauge-progress {
  transition: stroke-dashoffset 0.6s ease-in-out, stroke 0.3s ease;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.nc-gauge-widget {
  transition: background-color 0.3s ease;
}
</style>
