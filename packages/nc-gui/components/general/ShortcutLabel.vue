<script lang="ts" setup>
import { isMac } from '#imports'

const props = defineProps<{
  keys: string[]
}>()

const isMacOs = isMac()

const getLabel = (key: string) => {
  if (isMacOs) {
    switch (key.toLowerCase()) {
      case 'alt':
        return '⌥'
      case 'shift':
        return '⇧'
      case 'meta':
        return '⌘'
      case 'control':
        return '⌃'
      case 'enter':
        return '↩'
    }
  }
  switch (key.toLowerCase()) {
    case 'arrowup':
      return '↑'
    case 'arrowdown':
      return '↓'
    case 'arrowleft':
      return '←'
    case 'arrowright':
      return '→'
  }

  return key
}
</script>

<template>
  <div class="nc-shortcut-label-wrapper">
    <div v-for="(key, index) in props.keys" :key="index" class="nc-shortcut-label">
      <span>{{ getLabel(key) }}</span>
    </div>
  </div>
</template>

<style scoped>
.nc-shortcut-label-wrapper {
  @apply flex gap-1;
}

.nc-shortcut-label {
  @apply text-[.6rem] text-gray-200 bg-gray-200 bg-opacity-20 rounded  px-1;
}
</style>
