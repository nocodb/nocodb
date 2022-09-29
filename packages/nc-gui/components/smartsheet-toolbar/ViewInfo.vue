<script setup lang="ts">
import { ActiveViewInj, viewIcons } from '#imports'

const selectedView = inject(ActiveViewInj)
</script>

<template>
  <div class="flex gap-2 items-center ml-2 mr-2 pr-4 pb-1 py-0.5 border-r-1 border-gray-100">
    <component
      :is="viewIcons[selectedView?.type].icon"
      v-if="selectedView?.type"
      class="nc-view-icon group-hover:hidden"
      :style="{ color: viewIcons[selectedView?.type].color }"
    />
    <span class="!text-sm font-medium max-w-36 overflow-ellipsis overflow-hidden whitespace-nowrap">{{
      selectedView?.title
    }}</span>
  </div>
</template>
