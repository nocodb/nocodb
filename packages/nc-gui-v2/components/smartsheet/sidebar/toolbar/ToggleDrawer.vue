<script setup lang="ts">
/** Sidebar visible */
const { isOpen, toggle } = useSidebar({ storageKey: 'nc-right-sidebar' })
</script>

<template>
  <a-tooltip :placement="isOpen ? 'bottomRight' : 'left'" :mouse-enter-delay="0.8">
    <template #title> Toggle sidebar</template>

    <div class="nc-sidebar-right-item hover:after:(bg-primary bg-opacity-75) group nc-sidebar-add-row">
      <MdiChevronDoubleLeft
        class="cursor-pointer group-hover:(!text-white) transform transition-transform"
        :class="{ 'rotate-180': isOpen }"
        @click="toggle(!isOpen)"
      />
    </div>
  </a-tooltip>
</template>
