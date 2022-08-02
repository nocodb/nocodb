<script setup lang="ts">
import { inject, ref, useTable } from '#imports'
import { MetaInj, RightSidebarInj } from '~/context'
import MdiDeleteIcon from '~icons/mdi/delete-outline'

const meta = inject(MetaInj)

const { deleteTable } = useTable()

const sidebarOpen = inject(RightSidebarInj, ref(true))
</script>

<template>
  <a-tooltip :placement="sidebarOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('activity.deleteTable') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-red-500 group">
      <MdiDeleteIcon class="group-hover:(!text-white)" @click="deleteTable(meta)" />
    </div>
  </a-tooltip>
</template>
