<script setup lang="ts">
import { inject, useDeleteTable } from '#imports'
import { MetaInj } from '~/context'
import MdiDeleteIcon from '~icons/mdi/delete-outline'

const meta = inject(MetaInj)

const { deleteTable } = useDeleteTable()
</script>

<template>
  <a-tooltip placement="left">
    <template #title> {{ $t('activity.deleteTable') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-red-500 group">
      <MdiDeleteIcon class="group-hover:(!text-white)" @click="deleteTable(meta)" />
    </div>
  </a-tooltip>
</template>

