<script setup lang="ts">
interface Props {
  widget?: any
  config?: any
  isReadonly?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="widget-placeholder">
    <GeneralIcon :icon="widget" class="text-6xl text-gray-400 mb-4" />
    <h3 class="text-lg font-medium text-gray-600 mb-2">Widget Placeholder</h3>
    <p class="text-sm text-gray-500">This widget type is not yet supported</p>
  </div>
</template>

<style scoped lang="scss">
.widget-placeholder {
  @apply w-full h-full flex flex-col items-center justify-center text-center;
}
</style>
