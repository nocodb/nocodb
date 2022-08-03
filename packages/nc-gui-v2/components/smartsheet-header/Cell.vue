<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { inject } from 'vue'
import { ColumnInj, MetaInj } from '~/context'
import { useProvideColumnCreateStore } from '#imports'

const { column } = defineProps<{ column: ColumnType & { meta: any } }>()

provide(ColumnInj, column)

const meta = inject(MetaInj)

// instantiate column update store
useProvideColumnCreateStore(meta as Ref<TableType>, column)
</script>

<template>
  <div class="flex align-center w-full">
    <SmartsheetHeaderCellIcon v-if="column" />
    <span v-if="column" class="name" style="white-space: nowrap" :title="column.title">{{ column.title }}</span>

    <div class="flex-1" />
    <SmartsheetHeaderMenu />
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
