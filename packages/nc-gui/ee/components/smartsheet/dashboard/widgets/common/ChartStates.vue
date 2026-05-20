<script setup lang="ts">
interface Props {
  isLoading?: boolean
  isError?: boolean
  isEmpty?: boolean
}

defineProps<Props>()
</script>

<template>
  <div v-if="isError" class="bg-nc-bg-gray-extralight flex items-center justify-center h-full rounded-md">
    <SmartsheetDashboardWidgetsCommonWidgetsError />
  </div>
  <div v-else-if="isLoading" class="flex flex-col gap-3 h-full pt-2">
    <div class="h-2 bg-nc-bg-gray-light rounded animate-pulse w-2/5"></div>
    <div class="flex-1 bg-nc-bg-gray-light rounded animate-pulse"></div>
  </div>
  <div
    v-else-if="isEmpty"
    class="flex flex-col items-center justify-center h-full text-nc-content-gray-subtle2 gap-2"
  >
    <GeneralIcon icon="ncBarChart" class="w-8 h-8 opacity-40" />
    <div class="text-bodyDefaultSm">No data to show</div>
  </div>
  <slot v-else />
</template>
