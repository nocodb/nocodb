<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { useProvideLTARStore } from '~/composables'
import ItemChip from './components/ItemChip.vue'
import ListChildItems from './components/ListChildItems.vue'
import ListItems from './components/ListItems.vue'
import { ColumnInj, RowInj, ValueInj } from '~/context'

const column = inject(ColumnInj)
const row = inject(RowInj)
const value = inject(ValueInj)

const {
  relatedTableMeta,
  loadRelatedTableMeta,
  relatedTablePrimaryValueProp,
  unlink
} = useProvideLTARStore(column as Required<ColumnType>, row)

await loadRelatedTableMeta()

</script>

<template>
  <div class="d-flex d-100 chips-wrapper" :class="{ active }">
    <div class="flex align-center gap-1 w-full chips-wrapper group" :class="{ active }">
      <!--    <template v-if="!isForm"> -->
      <div class="chips flex align-center img-container flex-grow hm-items flex-nowrap min-w-0 overflow-hidden">
        <template v-if="value || localState">
          <ItemChip v-for="(ch, i) in value || localState" :key="i" :value="ch[relatedTablePrimaryValueProp]"
                    @unlink="unlink(ch)" />

          <!--
                      :active="active"     :item="ch"
                      :value="getCellValue(ch)"
                      :readonly="isLocked || isPublic"
                      @edit="editChild"
                      @unlink="unlinkChild "        -->

          <span v-if="value?.length === 10" class="caption pointer ml-1 grey--text"
                @click="childListDlg = true">more... </span>
        </template>
      </div>

      <MdiExpandIcon class="hidden group-hover:inline w-[20px] text-gray-500/50 hover:text-gray-500"
                     @click="childListDlg = true" />
      <MdiPlusIcon class="hidden group-hover:inline w-[20px] text-gray-500/50 hover:text-gray-500"
                   @click="listItemsDlg = true" />
      <ListItems v-model="listItemsDlg" />
      <ListChildItems v-model="childListDlg" />


    </div>
  </div>
</template>

