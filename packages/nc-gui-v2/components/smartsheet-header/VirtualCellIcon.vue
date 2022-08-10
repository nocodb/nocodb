<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import { toRef } from 'vue'
import { ColumnInj } from '~/context'
import GenericIcon from '~icons/mdi/square-rounded'
import HMIcon from '~icons/mdi/table-arrow-right'
import BTIcon from '~icons/mdi/table-arrow-left'
import MMIcon from '~icons/mdi/table-network'
import FormulaIcon from '~icons/mdi/math-integral'
import RollupIcon from '~icons/mdi/movie-roll'
import CountIcon from '~icons/mdi/counter'
import SpecificDBTypeIcon from '~icons/mdi/database-settings'
import TableColumnPlusBefore from '~icons/mdi/table-column-plus-before'

const props = defineProps<{ columnMeta?: ColumnType }>()
const columnMeta = toRef(props, 'columnMeta')

const column = inject(ColumnInj, ref(columnMeta))

const icon = computed(() => {
  switch (column?.value?.uidt) {
    case UITypes.LinkToAnotherRecord:
      switch ((column?.value?.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return MMIcon
        case RelationTypes.HAS_MANY:
          return HMIcon
        case RelationTypes.BELONGS_TO:
          return BTIcon
      }
      break
    case UITypes.SpecificDBType:
      return SpecificDBTypeIcon
    case UITypes.Formula:
      return FormulaIcon
    case UITypes.Lookup:
      return TableColumnPlusBefore
    case UITypes.Rollup:
      return RollupIcon
    case UITypes.Count:
      return CountIcon
  }
  return GenericIcon
})
</script>

<template>
  <component :is="icon" class="text-grey mx-1 !text-sm" />
</template>
