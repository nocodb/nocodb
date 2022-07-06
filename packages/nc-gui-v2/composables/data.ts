import type { ComputedRef, Ref } from 'vue'
import type { PaginatedType, TableType } from 'nocodb-sdk'
import { useNuxtApp } from '#app'
import { useProject } from '~/composables/project'

export const formatData = (list: Array<Record<string, any>>) => list.map(row => ({
  row: { ...row },
  oldRow: { ...row },
  rowMeta: {},
}))

export const useData = (meta: Ref<TableType> | ComputedRef<TableType>) => {
  const data = ref<Array<Record<string, any>>>()
  const formattedData = ref<Array<{ row: Record<string, any>; oldRow: Record<string, any> }>>()
  const paginationData = ref<PaginatedType>()

  const { project } = useProject()
  const { $api } = useNuxtApp()

  const loadData = async (params: { limit?: number; offset?: number; where?: string; sort?: string | string[]; fields?: string | string[] } = {}) => {
    const response = await $api.dbTableRow.list(
      'noco',
      project.value.id,
      meta.value.id,
      params as any,
    )
    data.value = response.list
    formattedData.value = formatData(response.list)
  }

  return { data, loadData, paginationData, formattedData }
}
