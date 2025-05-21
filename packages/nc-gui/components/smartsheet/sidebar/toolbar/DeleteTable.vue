<script setup lang="ts">
const meta = inject(MetaInj)!

const { deleteTable } = useTable()

const { isOpen } = useSidebar('nc-right-sidebar')
</script>

<template>
  <a-tooltip :placement="isOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('activity.deleteTable') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-red-500 group">
      <component :is="iconMap.delete" class="cursor-pointer" @click="deleteTable(meta)" />
    </div>
  </a-tooltip>
</template>
