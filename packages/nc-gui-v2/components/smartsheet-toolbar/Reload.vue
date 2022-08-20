<script setup lang="ts">
import { ReloadViewDataHookInj, inject } from '#imports'

const reloadHook = inject(ReloadViewDataHookInj)!

const onClick = () => reloadHook.trigger()
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> {{ $t('general.reload') }} </template>

    <div class="group flex align-center">
      <MdiReload class="cursor-pointer text-gray-500 group-hover:(text-primary)" @click="onClick" />
    </div>
  </a-tooltip>
</template>
