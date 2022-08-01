import type { Api, FormType, GalleryType, GridType, PaginatedType, TableType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { useNuxtApp } from '#app'
import { useProject } from '#imports'
import { NOCO } from '~/lib'

const formatData = (list: Record<string, any>[]) =>
  list.map((row) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {},
  }))

export function useViewData(
  meta: Ref<TableType> | ComputedRef<TableType> | undefined,
  viewMeta:
    | Ref<(GridType | GalleryType | FormType) & { id: string }>
    | ComputedRef<(GridType | GalleryType | FormType) & { id: string }>
    | undefined,
) {
  const data = ref<Record<string, any>[]>()
  const formattedData = ref<{ row: Record<string, any>; oldRow: Record<string, any>; rowMeta?: any }[]>()
  const paginationData = ref<PaginatedType>({ page: 1, pageSize: 25 })

  const { project } = useProject()
  const { $api } = useNuxtApp()

  const loadData = async (params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) => {
    if (!project?.value?.id || !meta?.value?.id || !viewMeta?.value?.id) return
    const response = await $api.dbViewRow.list('noco', project.value.id, meta.value.id, viewMeta.value.id, params)
    data.value = response.list
    formattedData.value = formatData(response.list)
    paginationData.value = response.pageInfo
  }

  const updateRowProperty = async (row: Record<string, any>, property: string) => {
    const id = meta?.value?.columns
      ?.filter((c) => c.pk)
      .map((c) => row[c.title as string])
      .join('___') as string

    return $api.dbViewRow.update(
      NOCO,
      project?.value.id as string,
      meta?.value.id as string,
      viewMeta?.value?.id as string,
      id,
      {
        [property]: row[property],
      },
      // todo:
      // {
      //   query: { ignoreWebhook: !saved }
      // }
    )

    /*

        todo: audit

        // audit
          this.$api.utils
            .auditRowUpdate(id, {
              fk_model_id: this.meta.id,
              column_name: column.title,
              row_id: id,
              value: getPlainText(rowObj[column.title]),
              prev_value: getPlainText(oldRow[column.title])
            })
            .then(() => {})
        */
  }
  const insertRow = async (row: Record<string, any>, rowIndex = formattedData.value?.length) => {
    // todo: implement insert row

    const insertObj = meta?.value?.columns?.reduce((o: any, col) => {
      if (!col.ai && row?.[col.title as string] !== null) {
        o[col.title as string] = row?.[col.title as string]
      }
      return o
    }, {})

    const insertedData = await $api.dbViewRow.create(
      NOCO,
      project?.value.id as string,
      meta?.value.id as string,
      viewMeta?.value?.id as string,
      insertObj,
    )

    formattedData.value?.splice(rowIndex ?? 0, 1, {
      row: insertedData,
      rowMeta: {},
      oldRow: { ...insertedData },
    })
  }

  const changePage = async (page: number) => {
    paginationData.value.page = page
    await loadData({ offset: (page - 1) * (paginationData.value.pageSize || 25) } as any)
  }

  return { data, loadData, paginationData, formattedData, insertRow, updateRowProperty, changePage }
}
