<script setup lang="ts">
import { inject, useTable } from '#imports'
import { MetaInj } from '~/context'

const meta = inject(MetaInj)!

const { deleteTable } = useTable()

const { rightSidebarOpen } = useGlobal()
</script>

<template>
  <a-tooltip :placement="rightSidebarOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('activity.deleteTable') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-red-500 group">
      <MdiDeleteOutline class="cursor-pointer group-hover:(!text-white)" @click="deleteTable(meta)" />
    </div>
  </a-tooltip>
</template>
