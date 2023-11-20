<script lang="ts" setup>
const debug = ref(false)

const clickCount = ref(0)

const onClick = () => {
  clickCount.value = clickCount.value + 1
  debug.value = clickCount.value >= 4
}
</script>

<template>
  <div class="flex gap-2 justify-start" @click="onClick">
    <slot name="start" />

    <span></span>

    <template v-if="debug">
      <LazySmartsheetSidebarToolbarExportCache />

      <div class="dot" />

      <LazySmartsheetSidebarToolbarDeleteCache />

      <div class="dot" />

      <LazySmartsheetSidebarToolbarDebugMeta />

      <div class="dot" />

      <LazySmartsheetSidebarToolbarBetaFeatureToggle />

      <div class="dot" />
    </template>

    <slot name="end" />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}

.dot {
  @apply w-[3px] h-[3px] bg-gray-300 rounded-full;
}
</style>
