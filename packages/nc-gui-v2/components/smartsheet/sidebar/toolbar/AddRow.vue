<script setup lang="ts">
import { inject, ref } from '#imports'
import { RightSidebarInj } from '~/context'

const emits = defineEmits(['addRow'])

const sidebarOpen = inject(RightSidebarInj, ref(true))
</script>

<template>
  <a-tooltip :placement="sidebarOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('activity.addRow') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-primary/75 group">
      <MdiPlusOutline class="group-hover:(!text-white)" @click="emits('addRow')" />
    </div>
  </a-tooltip>
</template>
