<script setup lang="ts">
import MdiMenuClose from '~icons/mdi/menu-close'

const drawerOpen = inject('navDrawerOpen', ref(false))
</script>

<template>
  <a-tooltip placement="left">
    <template #title> {{ $t('tooltip.toggleNavDraw') }} </template>
    <MdiMenuClose
      class="rounded text-xl p-1 text-gray-500 hover:(text-white bg-pink-500 shadow)"
      @click="drawerOpen = !drawerOpen"
    />
  </a-tooltip>
</template>
