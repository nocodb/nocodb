<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <div class="flex items-center border-gray-100 border-b-1 text-gray-600 px-4 py-2 justify-between">
    <div class="flex gap-3 items-center">
      <MaterialSymbolsSpaceDashboardOutlineRounded class="" />
      <h3 class="mb-0">Admin Dashboard</h3>
      <div class="bg-gray-50 p-1 rounded-md flex gap-1">
        <a-button class="nc-top-bar-btn">Edit Mode</a-button>
        <a-button class="nc-top-bar-btn">Preview Mode</a-button>
      </div>
    </div>
    <button
      class="py-1 px-2 flex text-white items-center rounded-md bg-[var(--ant-primary-color)] transition-opacity duration-200 hover:opacity-75"
    >
      <Icon class="mr-2 iconify" icon="lucide:share" /><span>Share</span>
    </button>
  </div>
</template>

<style scoped>
.nc-top-bar-btn {
  @apply border-none rounded-md drop-shadow;
}
</style>
