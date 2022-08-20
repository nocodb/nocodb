<script setup lang="ts">
/** Sidebar visible */
const { isOpen, toggle } = useSidebar({ storageKey: 'nc-right-sidebar' })
</script>

<template>
  <div :class="{ 'nc-active-btn': isOpen }">
    <a-button size="small" @click="toggle(!isOpen)">
      <div class="flex items-center gap-1 text-xs" :class="{ 'text-gray-500': !isOpen }">
        <MdiMenu class="!text-xs" />
        Views
      </div>
    </a-button>
  </div>
</template>
