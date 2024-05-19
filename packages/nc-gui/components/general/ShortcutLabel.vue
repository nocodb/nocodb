<script lang="ts" setup>
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
      case 'ctrl':
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
  @apply text-[0.7rem] leading-6 min-w-5 min-h-5 text-center relative z-0 after:(content-[''] left-0 top-0 -z-1 bg-current opacity-10 absolute w-full h-full rounded) px-1;
}
</style>
