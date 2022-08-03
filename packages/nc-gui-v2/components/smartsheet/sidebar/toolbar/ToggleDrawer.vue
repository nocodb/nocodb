<script setup lang="ts">
import MdiUnfoldMoreVertical from '~icons/mdi/unfold-more-vertical'
import MdiUnfoldLessVertical from '~icons/mdi/unfold-less-vertical'
import { inject, ref } from '#imports'
import { RightSidebarInj } from '~/context'

const sidebarOpen = inject(RightSidebarInj, ref(false))
</script>

<template>
  <a-tooltip :placement="sidebarOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('tooltip.toggleNavDraw') }} </template>

    <div class="nc-sidebar-right-item hover:after:bg-pink-500 group">
      <MdiUnfoldLessVertical v-if="sidebarOpen" class="group-hover:(!text-white)" @click="sidebarOpen = false" />
      <MdiUnfoldMoreVertical v-else class="group-hover:(!text-white)" @click="sidebarOpen = true" />
    </div>
  </a-tooltip>
</template>
