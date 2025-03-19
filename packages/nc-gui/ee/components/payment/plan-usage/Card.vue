<script lang="ts" setup>
import { PlanTitles } from 'nocodb-sdk'
import type { PlanMeta } from 'nocodb-sdk'

const props = defineProps<{
  used: number
  total: number
  title: string
  unit?: string
  planMeta?: (typeof PlanMeta)[keyof typeof PlanMeta]
}>()

const isInfinity = computed(() => !Number.isFinite(props.total))

const progressPercentage = computed(() => {
  if (isInfinity.value) {
    return 100
  }
  return Math.min(((props.used ?? 0) / (props.total || 1)) * 100, 100)
})

const isOverLimit = computed(() => {
  return (props.used ?? 0) / (props.total || 1) >= 0.8
})
</script>

<template>
  <div class="w-[300px] flex flex-col p-4 gap-2">
    <div class="flex items-center gap-2 text-nc-content-gray text-2xl font-bold">
      {{ used ?? 0 }} <span class="text-base">of</span>
      <span class="text-base">{{ isInfinity ? '∞' : (total || 0).toFixed() }}</span>
    </div>
    <div class="flex items-center gap-2">
      <div
        class="flex-1 h-2 rounded-lg"
        :class="{
          'bg-nc-bg-gray-medium': !isInfinity,
        }"
      >
        <div
          class="h-full rounded-lg"
          :class="{
            '!bg-red-500': isOverLimit,
          }"
          :style="{
            width: `${progressPercentage}%`,
            background: isInfinity
              ? `linear-gradient(90deg, ${planMeta?.accent} 50%, ${planMeta?.accent}00 100%)`
              : `${planMeta?.title === PlanTitles.FREE ? '#6A7184' : planMeta?.accent}`,
          }"
        ></div>
      </div>
    </div>
    <div class="flex items-center text-nc-content-gray-subtle2 text-sm">{{ title }}{{ unit ? ` (${unit})` : '' }}</div>
  </div>
</template>
