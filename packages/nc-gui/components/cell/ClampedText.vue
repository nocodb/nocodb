<script setup lang="ts">
const props = defineProps<{
  value?: string | number | null
  lines?: number
}>()

const renderedValue = computed(() => {
  return Array.isArray(props.value) ? props.value.join(',') : props.value
})
</script>

<template>
  <div v-if="!props.lines || props.lines === 1" class="nc-clamped-text text-ellipsis overflow-hidden">
    <span :style="{ 'word-break': 'keep-all', 'white-space': 'nowrap' }">{{ renderedValue ?? '' }}</span>
  </div>

  <div
    v-else
    class="nc-clamped-text"
    :style="{
      'display': '-webkit-box',
      'max-width': '100%',
      '-webkit-line-clamp': props.lines || 1,
      '-webkit-box-orient': 'vertical',
      'overflow': 'hidden',
      'word-break': 'break-all',
    }"
  >
    {{ renderedValue ?? '' }}
  </div>
</template>
