<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import ItemChip from './components/ItemChip.vue'
import { ColumnInj, ValueInj, RowInj } from '~/context'
import { useBelongsTo } from '#imports'
import { useProvideLTARStore } from '#imports'
import MdiExpandIcon from '~icons/mdi/arrow-expand'

const column = inject(ColumnInj)
const value = inject(ValueInj)
const row = inject(RowInj)
const active = false
const localState = null

const { relatedTableMeta, loadRelatedTableMeta, relatedTablePrimaryValueProp,childrenExcludedList } = useProvideLTARStore(column as ColumnType, row)
await loadRelatedTableMeta()
const data = await childrenExcludedList()
</script>

<template>
  <div class="flex w-full chips-wrapper align-center group" :class="{ active }">
    <div class="chips d-flex align-center flex-grow">
      <template v-if="value || localState">
        <ItemChip :active="active" :item="value" :value="value[relatedTablePrimaryValueProp]" />
      </template>
    </div>
    <div class="flex-1" />
    <MdiExpandIcon class="hidden group-hover:inline text-xs text-gray-500/50 hover:text-gray-500" />
  </div>
</template>
