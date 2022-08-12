<script lang="ts" setup>
import AddRow from './AddRow.vue'
import DeleteTable from './DeleteTable.vue'
import LockMenu from './LockMenu.vue'
import Reload from './Reload.vue'
</script>

<template>
  <div class="flex gap-2">
    <slot name="start" />

    <LockMenu />

    <div class="dot" />

    <Reload />

    <div class="dot" />

    <AddRow />

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
