<script setup lang="ts">
import type { ProgressBarShape } from 'nocodb-sdk'

interface Props {
  percentage: number
  isShowNumber?: boolean
  precision?: number
  shape?: ProgressBarShape
  circleSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  precision: 2,
  shape: 'bar',
  circleSize: 18,
})

const cPercentage = computed(() => Math.max(0, Math.min(100, props.percentage)))

const CIRCLE_STROKE_WIDTH = 2

const circleRadius = computed(() => (props.circleSize - CIRCLE_STROKE_WIDTH) / 2)

const circleCenter = computed(() => props.circleSize / 2)

const circleCircumference = computed(() => 2 * Math.PI * circleRadius.value)

const circleDashOffset = computed(() => circleCircumference.value * (1 - cPercentage.value / 100))

const slots = useSlots()

const slotHasChildren = (name?: string) => {
  return (slots[name ?? 'default']?.()?.length ?? 0) > 0
}
</script>

<template>
  <div
    class="flex flex-col w-full progress-container min-h-[4px]"
    style="align-self: stretch; justify-self: stretch; height: 100%; border-radius: 9999px"
  >
    <div class="progress-bar-input" :class="slotHasChildren() ? 'has-child' : ''">
      <slot></slot>
    </div>
    <div
      class="progress-bar flex items-center gap-2 w-full h-full"
      :class="{ 'min-h-[16px]': isShowNumber, 'px-2': isShowNumber && shape === 'circle' }"
    >
      <template v-if="shape === 'circle'">
        <span
          class="nc-percent-progress-circle inline-flex shrink-0"
          :style="{ width: `${circleSize}px`, height: `${circleSize}px`, transform: 'rotate(-90deg)' }"
        >
          <svg
            :width="circleSize"
            :height="circleSize"
            :viewBox="`0 0 ${circleSize} ${circleSize}`"
            style="shape-rendering: geometricprecision"
          >
            <circle
              class="nc-percent-progress-circle-track"
              :cx="circleCenter"
              :cy="circleCenter"
              :r="circleRadius"
              :stroke-width="1.5"
              fill="transparent"
            />
            <circle
              v-if="cPercentage > 0"
              class="nc-percent-progress-circle-bar"
              :cx="circleCenter"
              :cy="circleCenter"
              :r="circleRadius"
              :stroke-width="CIRCLE_STROKE_WIDTH"
              :stroke-dasharray="circleCircumference"
              :stroke-dashoffset="circleDashOffset"
              fill="transparent"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <div class="text-captionSm text-nc-content-gray-muted">
          {{ `${formatPercentage(percentage, precision)}` }}
        </div>
      </template>
      <template v-else>
        <div class="relative flex-1 flex rounded-full overflow-hidden self-center" :class="isShowNumber ? 'h-full' : 'h-[6px]'">
          <div class="bg-nc-brand-500" style="align-self: stretch" :style="{ width: `${cPercentage}%` }"></div>
          <div
            class="bg-[#e5e5e5] dark:bg-nc-bg-brand-inverted"
            style="align-self: stretch"
            :style="{ width: `${100 - cPercentage}%` }"
          ></div>
          <template v-if="isShowNumber">
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="text-captionSm leading-none" style="mix-blend-mode: difference; color: #ffffff">
                {{ `${formatPercentage(percentage, precision)}` }}
              </span>
            </div>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span class="text-captionSm leading-none" style="mix-blend-mode: overlay; color: #ffffff">
                {{ `${formatPercentage(percentage, precision)}` }}
              </span>
            </div>
          </template>
        </div>
        <div v-if="!isShowNumber" class="text-captionSm text-nc-content-gray-muted">
          {{ `${formatPercentage(percentage, precision)}` }}
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.progress-container:not(:focus-within):not(:hover) > div.progress-bar-input:not(:focus-within):not(:hover) {
  position: absolute;
  top: 0px;
  max-height: 0px !important;
  overflow-y: hidden;
}
.progress-container:focus-within > div.progress-bar-input.has-child,
.progress-container:hover > div.progress-bar-input.has-child {
  position: relative;
  width: 100%;
  max-height: 100%;
  height: 100%;
  overflow-y: hidden;
  transition: max-height 0.1s ease-in;
}

.progress-container:focus-within:has(div.progress-bar-input.has-child) > div.progress-bar,
.progress-container:hover:has(div.progress-bar-input.has-child) > div.progress-bar {
  visibility: collapse;
  opacity: 0;
  display: none;
  transition: visibility 0.1s ease-out, opacity 0.1s ease-out, display 0.1s allow-discrete;
}

.nc-percent-progress-circle {
  line-height: 0;
}

.nc-percent-progress-circle-track {
  stroke: #e5e5e5;
}

.dark .nc-percent-progress-circle-track {
  stroke: var(--nc-bg-brand-inverted);
}

.nc-percent-progress-circle-bar {
  stroke: var(--color-brand-500);
}
</style>
