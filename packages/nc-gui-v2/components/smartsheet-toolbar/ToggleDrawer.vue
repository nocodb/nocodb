<script setup lang="ts">
import MdiMenuClose from '~icons/mdi/menu-close'
import MdiUnfoldMoreVertical from '~icons/mdi/unfold-more-vertical'
import MdiUnfoldLessVertical from '~icons/mdi/unfold-less-vertical'

const drawerOpen = inject('navDrawerOpen', ref(false))
</script>

<template>
  <a-tooltip placement="left">
    <template #title> {{ $t('tooltip.toggleNavDraw') }} </template>
    <div class="nc-sidebar-right-item hover:after:bg-pink-500 group">
      <MdiUnfoldLessVertical class="group-hover:(!text-white)" v-if="drawerOpen" @click="drawerOpen = !drawerOpen" />
      <MdiUnfoldMoreVertical class="group-hover:(!text-white)" v-else @click="drawerOpen = !drawerOpen" />
    </div>
  </a-tooltip>
</template>
