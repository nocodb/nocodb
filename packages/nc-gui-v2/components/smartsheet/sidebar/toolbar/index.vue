<script lang="ts" setup>
import AddRow from './AddRow.vue'
import LockMenu from './LockMenu.vue'
import Reload from './Reload.vue'
import ExportCache from './ExportCache.vue'
import DeleteCache from './DeleteCache.vue'

const { isUIAllowed } = useUIPermission()

const debug = $ref(false)

const clickCount = $ref(0)
</script>

<template>
  <div
    class="flex gap-2"
    @click="
      () => {
        clickCount = clickCount + 1
        debug = clickCount >= 4
      }
    "
  >
    <slot name="start" />

    <template v-if="debug">
      <ExportCache />

      <div class="dot" />

      <DeleteCache />

      <div class="dot" />

      <!-- TODO: -->
      <!-- <debug-metas v-if="debug" class="mr-3" /> -->
    </template>

    <LockMenu v-if="isUIAllowed('view-type')" />

    <div v-if="isUIAllowed('view-type')" class="dot" />

    <Reload />

    <div class="dot" />

    <AddRow v-if="isUIAllowed('xcDatatableEditable')" />

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
