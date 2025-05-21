<script setup lang="ts">
const props = defineProps<{
  value?: string | number | null
  lines?: number
}>()
</script>

<template>
  <div v-if="!props.lines || props.lines === 1" class="text-ellipsis overflow-hidden">
    <span :style="{ 'word-break': 'keep-all', 'white-space': 'nowrap' }">{{ props.value ?? '' }}</span>
  </div>

  <div
    v-else
    :style="{
      'display': '-webkit-box',
      'max-width': '100%',
      '-webkit-line-clamp': props.lines || 1,
      '-webkit-box-orient': 'vertical',
      'overflow': 'hidden',
      'word-break': 'break-all',
    }"
  >
    {{ props.value ?? '' }}
  </div>
</template>
