import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { useMetas } from './useMetas'
import { useInjectionState } from '#imports'
import { useProject } from '~/composables/useProject'
import { NOCO } from '~/lib'

const [useProvideLTARStore, useLTARStore] = useInjectionState((column: ColumnType, row?: Record<string, any>) => {
  // state
  const { metas, getMeta } = useMetas()
  const { project } = useProject()
  const { $api } = useNuxtApp()

  // getters
  const meta = computed(() => metas?.value?.[column.fk_model_id as string])
  const relatedTableMeta = computed<TableType>(() => {
    return metas.value?.[(column.colOptions as any)?.fk_related_model_id as string]
  })

  const rowId = computed(() =>
    meta.value.columns
      .filter((c) => c.pk)
      .map((c) => row?.[c.title])
      .join('___'),
  )

  // actions
  const loadRelatedTableMeta = async () => {
    await getMeta((column.colOptions as any)?.fk_related_model_id as string)
  }

  const relatedTablePrimaryValueProp = computed(() => {
    return (relatedTableMeta?.value?.columns?.find((c) => c.pv) || relatedTableMeta?.value?.columns?.[0])?.title
  })

  const size = 25
  const query = ''
  const page = 1
  const childrenExcludedList = async () => {
    // this.data =
    return await $api.dbTableRow.nestedChildrenExcludedList(
      NOCO,
      project.value.id as string,
      meta.value.title,
      rowId.value,
      (column.colOptions as LinkToAnotherRecordType).type as 'mm' | 'hm',
      column.title as string,
      // todo: swagger type correction
      {
        limit: size,
        offset: size * (page - 1),
        where: query && `(${relatedTablePrimaryValueProp.value},like,${query})`,
      } as any,
    )
  }

  return { relatedTableMeta, loadRelatedTableMeta, relatedTablePrimaryValueProp, childrenExcludedList, rowId }
}, 'ltar-store')

export { useProvideLTARStore }

export function useLTARStoreOrThrow() {
  const ltarStore = useLTARStore()
  if (ltarStore == null) throw new Error('Please call `useLTARStore` on the appropriate parent component')
  return ltarStore
}
