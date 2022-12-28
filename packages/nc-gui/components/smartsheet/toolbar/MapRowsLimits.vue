<script setup lang="ts">
// import type { MapType } from 'nocodb-sdk'
// import { UITypes } from 'nocodb-sdk'
// import type { SelectProps } from 'ant-design-vue'
import { PaginationDataInj, computed, inject } from '#imports'
const { count } = useSmartsheetStoreOrThrow()
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> You're getting close to the limit. The limit of markers in a Map View is 1000 records. </template>

    <div class="nc-warning-info flex min-w-32px h-32px items-center gap-1 px-2">
      <div>{{ count }} records</div>
      <mdi-map-marker-alert />
    </div>
  </a-tooltip>
</template>