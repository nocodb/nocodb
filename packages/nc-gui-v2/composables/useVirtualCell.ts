import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import { computed } from '#imports'

export function useVirtualCell(column: ColumnType) {
  const isHm = computed(
    () =>
      column.uidt === UITypes.LinkToAnotherRecord && (<LinkToAnotherRecordType>column.colOptions).type === RelationTypes.HAS_MANY,
  )
  const isMm = computed(
    () =>
      column.uidt === UITypes.LinkToAnotherRecord &&
      (<LinkToAnotherRecordType>column.colOptions).type === RelationTypes.MANY_TO_MANY,
  )
  const isBt = computed(
    () =>
      column.uidt === UITypes.LinkToAnotherRecord &&
      (<LinkToAnotherRecordType>column.colOptions).type === RelationTypes.BELONGS_TO,
  )
  const isLookup = computed(() => column.uidt === UITypes.Lookup)
  const isRollup = computed(() => column.uidt === UITypes.Rollup)
  const isFormula = computed(() => column.uidt === UITypes.Formula)

  return {
    isHm,
    isMm,
    isBt,
    isLookup,
    isRollup,
    isFormula,
  }
}
