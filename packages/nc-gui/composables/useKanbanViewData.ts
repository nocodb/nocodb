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
  const groupingFieldColOptions = ref<Record<string, any>[]>([])
  const kanbanMetaData = ref<KanbanType>()
  // {
  //   [val1] : [
  //     {row: {...}, oldRow: {...}, rowMeta: {...}},
  //     {row: {...}, oldRow: {...}, rowMeta: {...}},
  //     ...
  //   ],
  //   [val2] : [
  //     {row: {...}, oldRow: {...}, rowMeta: {...}},
  //     {row: {...}, oldRow: {...}, rowMeta: {...}},
  //     ...
  //   ],
  // }
  const formattedData = ref<Record<string, Row[]>>({})
  // TODO: retrieve from meta
  const groupingField = 'singleSelect2'

  const formatData = (list: Record<string, any>[]) =>
    list.map((row) => ({
      row: { ...row },
      oldRow: { ...row },
      rowMeta: {},
    }))

  async function loadKanbanData(params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
    // each stack only loads 25 records -> scroll to load more (to be integrated with infinite scroll)
    // TODO: integrate with infinite scroll
    // TODO: handle share view case
    if ((!project?.value?.id || !meta?.value?.id || !viewMeta?.value?.id) && !isPublic.value) return

    // grouping field column options
    const groupingFieldColumn = meta?.value?.columns?.filter((f) => f.title === groupingField)[0] as Record<string, any>
    groupingFieldColOptions.value = [
      ...(groupingFieldColumn?.colOptions?.options ?? []),
      { id: 'uncategorized', title: 'Uncategorized', order: 0 },
    ].sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order)

    await Promise.all(
      groupingFieldColOptions.value.map(async (option) => {
        let where = `(${groupingField},eq,${option.title})`
        if (option.title === 'Uncategorized') {
          where = `(${groupingField},is,null)`
        }
        const response = await api.dbViewRow.list('noco', project.value.id!, meta!.value.id!, viewMeta!.value.id, {
          ...params,
          ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
          ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
          where,
        })

        formattedData.value[option.id] = formatData(response.list)
      }),
    )
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
    formattedData,
    groupingFieldColOptions,
    updateOrSaveRow,
    addEmptyRow,
  }
}
