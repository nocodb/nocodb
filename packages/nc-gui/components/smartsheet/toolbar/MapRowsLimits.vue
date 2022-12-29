<script setup lang="ts">
const { syncCount, paginationData } = useMapViewStoreOrThrow()

const count = computed(() => {
  return paginationData.value.totalRows
})

syncCount()
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title>
      <span v-if="count > 1000"> You're over the limit. </span>
      <span v-else> You're getting close to the limit. </span>
      <span> The limit of markers shown in a Map View is 1000 records. </span>
    </template>

    <div v-if="count > 900" class="nc-warning-info flex min-w-32px h-32px items-center gap-1 px-2">
      <div>{{ count }} records</div>
      <mdi-map-marker-alert />
    </div>
  </a-tooltip>
</template>
