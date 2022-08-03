<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import ItemChip from './components/ItemChip.vue'
import ListChildItems from './components/ListChildItems.vue'
import ListItems from './components/ListItems.vue'
import { useProvideLTARStore } from '~/composables'
import { ColumnInj, RowInj, ValueInj } from '~/context'
import MdiExpandIcon from '~icons/mdi/arrow-expand'
import MdiPlusIcon from '~icons/mdi/plus'

const column = inject(ColumnInj)
const value = inject(ValueInj)
const row = inject(RowInj)

const listItemsDlg = ref(false)
const childListDlg = ref(false)

const { relatedTableMeta, loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Required<ColumnType>,
  row,
)
await loadRelatedTableMeta()
</script>

<template>
  <div class="flex align-center gap-1 w-full chips-wrapper group">
    <div class="chips flex align-center img-container flex-grow hm-items flex-nowrap min-w-0 overflow-hidden">
      <template v-if="value">
        <ItemChip v-for="(ch, i) in value" :key="i" :value="ch[relatedTablePrimaryValueProp]" @unlink="unlink(ch)" />
        <span v-if="value?.length === 10" class="caption pointer ml-1 grey--text" @click="childListDlg = true">more... </span>
      </template>
    </div>

    <MdiExpandIcon class="hidden group-hover:inline w-[20px] text-gray-500/50 hover:text-gray-500" @click="childListDlg = true" />
    <MdiPlusIcon class="hidden group-hover:inline w-[20px] text-gray-500/50 hover:text-gray-500" @click="listItemsDlg = true" />
    <ListItems v-model="listItemsDlg" />
    <ListChildItems v-model="childListDlg" />
  </div>
</template>
