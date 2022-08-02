<script setup lang="ts">
import { ReloadViewDataHookInj, RightSidebarInj } from '~/context'
import MdiReloadIcon from '~icons/mdi/reload'
import { inject, ref } from '#imports'

const reloadTri = inject(ReloadViewDataHookInj)

const sidebarOpen = inject(RightSidebarInj, ref(true))
</script>

<template>
  <a-tooltip :placement="sidebarOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('general.reload') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-green-500 group">
      <MdiReloadIcon class="group-hover:(!text-white)" @click="reloadTri.trigger()" />
    </div>
  </a-tooltip>
</template>

<style scoped></style>
