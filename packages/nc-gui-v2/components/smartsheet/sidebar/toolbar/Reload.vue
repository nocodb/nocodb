<script setup lang="ts">
import { ReloadViewDataHookInj, RightSidebarInj } from '~/context'
import { inject, ref } from '#imports'

const reloadTri = inject(ReloadViewDataHookInj)!

const sidebarOpen = inject(RightSidebarInj, ref(true))
</script>

<template>
  <a-tooltip :placement="sidebarOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('general.reload') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-green-500 group">
      <MdiReload class="group-hover:(!text-white)" @click="reloadTri.trigger(null)" />
    </div>
  </a-tooltip>
</template>
