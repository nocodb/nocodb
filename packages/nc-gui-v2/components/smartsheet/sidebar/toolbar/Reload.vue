<script setup lang="ts">
import { ReloadViewDataHookInj, inject } from '#imports'

const reloadHook = inject(ReloadViewDataHookInj)!

const onClick = () => reloadHook.trigger()
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> {{ $t('general.reload') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-green-500 group">
      <MdiReload class="cursor-pointer group-hover:(!text-white)" @click="onClick" />
    </div>
  </a-tooltip>
</template>
