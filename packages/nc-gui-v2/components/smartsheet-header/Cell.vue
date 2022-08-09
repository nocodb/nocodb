<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { inject, toRef } from 'vue'
import { ColumnInj, MetaInj } from '~/context'
import { useProvideColumnCreateStore } from '#imports'

const props = defineProps<{ column: ColumnType & { meta: any }; required: boolean; hideMenu?: boolean }>()

const hideMenu = toRef(props, 'hideMenu')

const meta = inject(MetaInj)

const column = toRef(props, 'column')

provide(ColumnInj, column)

// instantiate column update store
useProvideColumnCreateStore(meta as Ref<TableType>, column)
</script>

<template>
  <div class="flex align-center w-full">
    <SmartsheetHeaderCellIcon v-if="column" />
    <span v-if="column" class="name" style="white-space: nowrap" :title="column.title">{{ column.title }}</span>
    <span v-if="(column.rqd && !column.cdf) || required" class="text-red-500">&nbsp;*</span>

    <template v-if="!hideMenu">
      <div class="flex-1" />
      <SmartsheetHeaderMenu />
    </template>
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
