<script setup lang="ts">
const props = defineProps<{
  value?: string | number | null
  lines?: number
}>()
</script>

<template>
  <div
    :style="{
      'display': '-webkit-box',
      'max-width': '100%',
      '-webkit-line-clamp': props.lines || 1,
      '-webkit-box-orient': 'vertical',
      'overflow': 'hidden',
    }"
  >
    {{ props.value || '' }}
  </div>
</template>
