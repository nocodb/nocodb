<script lang="ts" setup>
let debug = $ref(false)

let clickCount = $ref(0)

const onClick = () => {
  clickCount = clickCount + 1
  debug = clickCount >= 4
}
</script>

<template>
  <div class="flex gap-2 justify-start" @click="onClick">
    <slot name="start" />

    <LazySmartsheetSidebarToolbarToggleDrawer />

    <span></span>

    <template v-if="debug">
      <LazySmartsheetSidebarToolbarExportCache />

      <div class="dot" />

      <LazySmartsheetSidebarToolbarDeleteCache />

      <div class="dot" />

      <LazySmartsheetSidebarToolbarDebugMeta />

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
