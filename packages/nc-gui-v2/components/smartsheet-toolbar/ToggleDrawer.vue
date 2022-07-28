<script setup lang="ts">
import { ReloadViewDataHookInj } from '~/context'
import MdiDoorOpenIcon from '~icons/mdi/door-open'
import MdiDoorClosedIcon from '~icons/mdi/door-closed'
const navDrawerOpened = ref(false)

const Icon = computed(() => (navDrawerOpened.value ? MdiDoorOpenIcon : MdiDoorClosedIcon))
</script>

<template>
  <a-tooltip>
    <template #title> {{ $t('tooltip.toggleNavDraw') }} </template>
    <Icon
      class="rounded text-xl p-1 text-gray-500 hover:(text-white bg-pink-500 shadow)"
      @click="navDrawerOpened = !navDrawerOpened"
    />
  </a-tooltip>
</template>

<style scoped></style>
