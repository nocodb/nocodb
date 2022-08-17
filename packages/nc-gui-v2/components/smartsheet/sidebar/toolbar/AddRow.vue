<script setup lang="ts">
const emits = defineEmits(['addRow'])
const { isOpen } = useSidebar({ storageKey: 'nc-right-sidebar' })
</script>

<template>
  <a-tooltip :placement="isOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('activity.addRow') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-primary/75 group nc-sidebar-add-row">
      <MdiPlusOutline class="cursor-pointer group-hover:(!text-white)" @click="emits('addRow')" />
    </div>
  </a-tooltip>
</template>
