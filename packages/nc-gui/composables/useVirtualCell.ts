import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { computed } from '#imports'

export function useVirtualCell(column: Ref<ColumnType | undefined>) {
  const isHm = computed(
    () =>
      column.value?.uidt === UITypes.LinkToAnotherRecord &&
      (<LinkToAnotherRecordType>column.value?.colOptions).type === RelationTypes.HAS_MANY,
  )
  const isMm = computed(
    () =>
      column.value?.uidt === UITypes.LinkToAnotherRecord &&
      (<LinkToAnotherRecordType>column.value?.colOptions).type === RelationTypes.MANY_TO_MANY,
  )
  const isBt = computed(
    () =>
      column.value?.uidt === UITypes.LinkToAnotherRecord &&
      (<LinkToAnotherRecordType>column.value?.colOptions).type === RelationTypes.BELONGS_TO,
  )
  const isLookup = computed(() => column.value?.uidt === UITypes.Lookup)
  const isRollup = computed(() => column.value?.uidt === UITypes.Rollup)
  const isFormula = computed(() => column.value?.uidt === UITypes.Formula)
  const isCount = computed(() => column.value?.uidt === UITypes.Count)

  return {
    isHm,
    isMm,
    isBt,
    isLookup,
    isRollup,
    isFormula,
    isCount,
  }
}
