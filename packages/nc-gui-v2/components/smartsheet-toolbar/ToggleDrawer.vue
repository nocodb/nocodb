<script setup lang="ts">
import MdiDoorOpenIcon from '~icons/mdi/door-open'
import MdiDoorClosedIcon from '~icons/mdi/door-closed'

const drawerOpen = inject('navDrawerOpen', ref(false))
const Icon = computed(() => (drawerOpen.value ? MdiDoorOpenIcon : MdiDoorClosedIcon))
</script>

<template>
  <a-tooltip placement="left">
    <template #title> {{ $t('tooltip.toggleNavDraw') }} </template>
    <Icon class="rounded text-xl p-1 text-gray-500 hover:(text-white bg-pink-500 shadow)" @click="drawerOpen = !drawerOpen" />
  </a-tooltip>
</template>
