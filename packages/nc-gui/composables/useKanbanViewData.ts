import type { ComputedRef, Ref } from 'vue'
import type { Api, KanbanType, TableType, ViewType } from 'nocodb-sdk'
import { useI18n } from 'vue-i18n'
import type { Row } from '~/composables/useViewData'
import { useNuxtApp } from '#app'

export function useKanbanViewData(
  meta: Ref<TableType> | ComputedRef<TableType> | undefined,
  viewMeta: Ref<ViewType & { id: string }> | ComputedRef<ViewType & { id: string }> | undefined,
  where?: ComputedRef<string | undefined>,
) {
  const { t } = useI18n()
  const isPublic = inject(IsPublicInj, ref(false))
  const { api } = useApi()
  const { project } = useProject()
  const { $api, $e } = useNuxtApp()
  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()
  const { isUIAllowed } = useUIPermission()
  const kanbanMetaData = ref<KanbanType>()
  const formattedData = ref<Record<string, Row[]>>()

  const formatData = (list: Record<string, any>[]) => {
    const groupingField = 'singleSelect2'
    const groupingFieldColumn = meta?.value?.columns?.filter((f) => f.title === groupingField)[0] as Record<string, any>
    // TODO: sort by kanban meta
    const groupingFieldColumnOptions = [
      ...(groupingFieldColumn?.colOptions?.options ?? []),
      { title: 'Uncategorized', order: 0 },
    ].sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order)
    const initialAcc = groupingFieldColumnOptions.reduce((acc: any, obj: any) => {
      if (!acc[obj.title]) {
        acc[obj.title] = []
      }
      return acc
    }, {})
    return {
      meta: groupingFieldColumnOptions,
      data: list.reduce((acc: any, obj: any) => {
        // TODO: grouping field
        const key = obj[groupingField] === null ? 'Uncategorized' : obj[groupingField]
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push({
          row: { ...obj },
          oldRow: { ...obj },
          rowMeta: {},
        })
        return acc
      }, initialAcc),
    }
  }

  async function loadKanbanData(params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
    if ((!project?.value?.id || !meta?.value?.id || !viewMeta?.value?.id) && !isPublic.value) return
    // TODO: handle share view case
    const response = await api.dbViewRow.list('noco', project.value.id!, meta!.value.id!, viewMeta!.value.id, {
      ...params,
      ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
      ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
      where: where?.value,
    })
    formattedData.value = formatData(response.list)
  }

  async function loadKanbanMeta() {
    if (!viewMeta?.value?.id) return
    kanbanMetaData.value = await $api.dbView.kanbanRead(viewMeta.value.id)
  }

  async function updateOrSaveRow(row: Row, property: string) {
    // TODO: implement
  }

  function addEmptyRow(addAfter?: number) {
    // TODO: implement
  }

  return {
    loadKanbanData,
    loadKanbanMeta,
    kanbanMetaData,
    formatData,
    updateOrSaveRow,
    addEmptyRow,
  }
}
