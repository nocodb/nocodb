<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import ItemChip from './components/ItemChip.vue'
import ListItems from './components/ListItems.vue'
import { useProvideLTARStore } from '#imports'
import { ColumnInj, ReloadViewDataHookInj, RowInj, ValueInj } from '~/context'
import MdiExpandIcon from '~icons/mdi/arrow-expand'

const column = inject(ColumnInj)
const reloadTrigger = inject(ReloadViewDataHookInj)
const value = inject(ValueInj)
const row = inject(RowInj)
const active = false
const localState = null
const listItemsDlg = ref(false)

const { relatedTableMeta, loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Required<ColumnType>,
  row,
  () => reloadTrigger?.trigger()
)
await loadRelatedTableMeta()
</script>

<template>
  <div class="flex w-full chips-wrapper align-center group" :class="{ active }">
    <div class="chips d-flex align-center flex-grow">
      <template v-if="value || localState">
        <ItemChip :item="value" :value="value[relatedTablePrimaryValueProp]" @unlink="unlink(value || localState)" />
      </template>
    </div>
    <div class="flex-1" />
    <MdiExpandIcon class="hidden group-hover:inline text-md text-gray-500/50 hover:text-gray-500" @click="listItemsDlg = true" />
    <ListItems v-model="listItemsDlg" />
  </div>
</template>
