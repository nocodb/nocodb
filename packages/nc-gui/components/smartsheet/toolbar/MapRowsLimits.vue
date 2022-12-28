<script setup lang="ts">
// import type { MapType } from 'nocodb-sdk'
// import { UITypes } from 'nocodb-sdk'
// import type { SelectProps } from 'ant-design-vue'
import { ActiveViewInj, MetaInj, inject, useViewData } from '#imports'
// const { totalNumberOfTableRows } = useSmartsheetStoreOrThrow()

const meta = inject(MetaInj)

const view = inject(ActiveViewInj)

const FOO = useViewData(meta!, view!)
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> You're getting close to the limit. The limit of markers in a Map View is 1000 records. </template>

    <div class="nc-warning-info flex min-w-32px h-32px items-center gap-1 px-2">
      <div>{{ FOO.paginationData.value.totalRows }} records</div>
      <mdi-map-marker-alert />
    </div>
  </a-tooltip>
</template>