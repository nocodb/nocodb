<script setup lang="ts">
import { ReloadViewDataHookInj, inject, useNuxtApp } from '#imports'

const { $e } = useNuxtApp()

const reloadHook = inject(ReloadViewDataHookInj)!

const onClick = () => {
  $e('a:table:reload:navbar')
  reloadHook.trigger()
}
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> {{ $t('general.reload') }} </template>

    <div class="group flex align-center">
      <MdiReload class="cursor-pointer text-gray-500 group-hover:(text-primary) nc-toolbar-reload-btn" @click="onClick" />
    </div>
  </a-tooltip>
</template>
