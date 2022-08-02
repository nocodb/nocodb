<script setup lang="ts">
import { ReloadViewDataHookInj } from '~/context'
import MdiReloadIcon from '~icons/mdi/reload'

const reloadTri = inject(ReloadViewDataHookInj)
</script>

<template>
  <a-tooltip placement="left">
    <template #title> {{ $t('general.reload') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-green-500 group">
      <MdiReloadIcon class="group-hover:(!text-white)" @click="reloadTri.trigger()" />
    </div>
  </a-tooltip>
</template>

<style scoped></style>
