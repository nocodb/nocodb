<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import { ColumnInj } from '~/context'
import GenericIcon from '~icons/mdi/square-rounded'
import HMIcon from '~icons/mdi/table-arrow-right'
import BTIcon from '~icons/mdi/table-arrow-left'
import MMIcon from '~icons/mdi/table-network'
import FormulaIcon from '~icons/mdi/math-integral'
import RollupIcon from '~icons/mdi/movie-roll'

const { columnMeta } = defineProps<{ columnMeta?: ColumnType }>()

const column = inject(ColumnInj, columnMeta)

const icon = computed(() => {
  switch (column?.uidt) {
    case UITypes.LinkToAnotherRecord:
      switch ((column?.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return MMIcon
        case RelationTypes.HAS_MANY:
          return HMIcon
        case RelationTypes.BELONGS_TO:
          return BTIcon
      }
      break
    case UITypes.Formula:
      return FormulaIcon
    case UITypes.Lookup:
      return GenericIcon
    case UITypes.Rollup:
      return RollupIcon
  }
  return GenericIcon
})
</script>

<template>
  <component :is="icon" class="text-grey mx-1 !text-sm" />
</template>
