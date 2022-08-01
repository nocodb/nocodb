<script setup lang="ts">
import MdiMenuClose from '~icons/mdi/menu-close'

const drawerOpen = inject('navDrawerOpen', ref(false))
</script>

<template>
  <a-tooltip placement="left">
    <template #title> {{ $t('tooltip.toggleNavDraw') }} </template>
    <div class="nc-sidebar-right-item hover:after:bg-pink-500 group">
      <MdiMenuClose class="group-hover:(!text-white)" @click="drawerOpen = !drawerOpen" />
    </div>
  </a-tooltip>
</template>
