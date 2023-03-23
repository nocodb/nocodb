<script setup lang="ts">
import { ReloadViewDataHookInj, iconMap, inject, ref, useNuxtApp, watch } from '#imports'

const { $e, $state } = useNuxtApp()

const reloadHook = inject(ReloadViewDataHookInj)!

const isReloading = ref(false)

const onClick = () => {
  $e('a:table:reload:navbar')
  isReloading.value = true
  reloadHook.trigger()

  const stop = watch($state.isLoading, (isLoading) => {
    if (!isLoading) {
      isReloading.value = false
      stop()
    }
  })
}
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> {{ $t('general.reload') }} </template>

    <div class="nc-toolbar-btn flex min-w-32px w-32px h-32px items-center">
      <component
        :is="iconMap.reload"
        class="w-full h-full cursor-pointer text-gray-500 group-hover:(text-primary) nc-toolbar-reload-btn"
        :class="isReloading ? 'animate-spin' : ''"
        @click="onClick"
      />
    </div>
  </a-tooltip>
</template>
