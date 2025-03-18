<script lang="ts" setup>
const props = defineProps<{
  used: number
  total: number
  title: string
  unit?: string
}>()

const isInfinity = computed(() => !Number.isFinite(props.total))
</script>

<template>
  <div class="w-[300px] flex flex-col p-4 gap-2">
    <div class="flex items-center gap-2 text-nc-content-gray text-2xl font-bold">
      {{ used ?? 0 }} <span class="text-base">of</span>
      <span class="text-base">{{ isInfinity ? '∞' : total ?? 0 }}</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="flex-1 h-2 bg-nc-border-gray-medium rounded-lg">
        <div
          class="h-full bg-brand-500 rounded-lg"
          :class="{
            '!bg-red-500': (used ?? 0) / (total ?? 1) >= 0.8,
            'bg-gradient-to-r from-brand-500 to-brand-100': isInfinity,
          }"
          :style="{
            width: `${isInfinity ? 100 : ((used ?? 0) / (total ?? 1)) * 100}%`,
          }"
        ></div>
      </div>
    </div>
    <div class="flex items-center text-nc-content-gray-subtle2 text-sm">{{ title }}{{ unit ? ` (${unit})` : '' }}</div>
  </div>
</template>
