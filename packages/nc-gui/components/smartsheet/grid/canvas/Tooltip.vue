<script setup lang="ts">
const { theme = 'dark' } = defineProps<{
  tooltipStyle: any
  theme?: 'light' | 'dark'
}>()
const store = useTooltipStore()
const { tooltipText } = storeToRefs(store)
</script>

<template>
  <div class="tooltip" :class="[`tooltip-${theme}`]" :style="tooltipStyle">
    {{ tooltipText }}
  </div>
</template>

<style lang="scss">
.tooltip {
  @apply pointer-events-none px-2 py-1 max-w-[250px] rounded-lg text-xs whitespace-pre-line break-words;
  z-index: 1000;
}

.tooltip.hidden {
  @apply invisible;
}

.tooltip-dark {
  @apply bg-gray-800 text-white;
}

.tooltip-light {
  @apply bg-gray-200 text-gray-800;
}

.tooltip-enter-active,
.tooltip-leave-active {
  @apply transition-opacity duration-150 ease-in-out;
}

.tooltip-enter-from,
.tooltip-leave-to {
  @apply opacity-0;
}
</style>
