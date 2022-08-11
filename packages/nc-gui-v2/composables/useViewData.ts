import type { Api, FormType, ColumnType, GalleryType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { notification } from 'ant-design-vue'
import { useNuxtApp } from '#app'
import { useProject } from '#imports'
import { NOCO } from '~/lib'
import { extractPkFromRow, extractSdkResponseErrorMsg } from '~/utils'

const formatData = (list: Record<string, any>[]) =>
  list.map((row) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {},
  }))

export interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: {
    new?: boolean
    commentCount?: number
  }
}

export function useViewData(
  meta: Ref<TableType> | ComputedRef<TableType> | undefined,
  viewMeta: Ref<ViewType & { id: string }> | ComputedRef<ViewType & { id: string }> | undefined,
  where?: ComputedRef<string | undefined>,
) {
  if (!meta) {
    throw new Error('Table meta is not available')
  }

  const formattedData = ref<Row[]>([])
  const paginationData = ref<PaginatedType>({ page: 1, pageSize: 25 })
  const aggCommentCount = ref<Record<string, number>[]>([])
  const galleryData = ref<GalleryType | undefined>(undefined)
  const formColumnData = ref<FormType | undefined>(undefined)
  const formViewData = ref<FormType | undefined>(undefined)

  const { project } = useProject()
  const { $api } = useNuxtApp()

  const selectedAllRecords = computed({
    get() {
      return formattedData.value.every((row: Record<string, any>) => row.rowMeta.selected)
    },
    set(selected) {
      formattedData.value.forEach((row: Record<string, any>) => (row.rowMeta.selected = selected))
    },
  })

  const syncCount = async () => {
    const { count } = await $api.dbViewRow.count(
      NOCO,
      project?.value?.title as string,
      meta?.value?.id as string,
      viewMeta?.value?.id as string,
    )
    paginationData.value.totalRows = count
  }

  const queryParams = computed(() => ({
    offset: (paginationData.value?.page ?? 0) - 1,
    limit: paginationData.value?.pageSize ?? 25,
    where: where?.value ?? '',
  }))

  /** load row comments count */
  const loadAggCommentsCount = async () => {
    // todo: handle in public api
    // if (this.isPublicView) {
    //   return;
    // }

    const ids = formattedData.value
      ?.filter(({ rowMeta: { new: isNew } }) => !isNew)
      ?.map(({ row }) => {
        return extractPkFromRow(row, meta?.value?.columns as ColumnType[])
      })

    if (!ids?.length) return

    aggCommentCount.value = await $api.utils.commentCount({
      ids,
      fk_model_id: meta.value.id as string,
    })

    for (const row of formattedData.value) {
      const id = extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])
      row.rowMeta.commentCount = aggCommentCount.value?.find((c: Record<string, any>) => c.row_id === id)?.count || 0
    }
  }

  const loadData = async (params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) => {
    if (!project?.value?.id || !meta?.value?.id || !viewMeta?.value?.id) return
    const response = await $api.dbViewRow.list('noco', project.value.id, meta.value.id, viewMeta.value.id, {
      ...params,
      where: where?.value,
    })
    formattedData.value = formatData(response.list)
    paginationData.value = response.pageInfo

    loadAggCommentsCount()
  }

  const loadGalleryData = async () => {
    if (!viewMeta?.value?.id) return

    galleryData.value = await $api.dbView.galleryRead(viewMeta.value.id)
  }

  const insertRow = async (row: Record<string, any>, rowIndex = formattedData.value?.length) => {
    try {
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
      syncCount()
    } catch (error: any) {
      notification.error({
        message: 'Row insert failed',
        description: await extractSdkResponseErrorMsg(error),
      })
    }
  }

  const updateRowProperty = async (row: Record<string, any>, property: string) => {
    try {
      const id = meta?.value?.columns
        ?.filter((c) => c.pk)
        .map((c) => row[c.title as string])
        .join('___') as string

      return await $api.dbViewRow.update(
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
    } catch (error: any) {
      notification.error({
        message: 'Row update failed',
        description: await extractSdkResponseErrorMsg(error),
      })
    }
  }

  const updateOrSaveRow = async (row: Row, property: string) => {
    if (row.rowMeta.new) {
      await insertRow(row.row, formattedData.value.indexOf(row))
    } else {
      await updateRowProperty(row.row, property)
    }
  }
  const changePage = async (page: number) => {
    paginationData.value.page = page
    await loadData({ offset: (page - 1) * (paginationData.value.pageSize || 25), where: where?.value } as any)
  }

  const addEmptyRow = (addAfter = formattedData.value.length) => {
    formattedData.value.splice(addAfter, 0, {
      row: {},
      oldRow: {},
      rowMeta: { new: true },
    })
  }

  const deleteRowById = async (id: string) => {
    if (!id) {
      throw new Error("Delete not allowed for table which doesn't have primary Key")
    }

    const res: any = await $api.dbViewRow.delete(
      'noco',
      project.value.id as string,
      meta?.value.id as string,
      viewMeta?.value.id as string,
      id,
    )

    if (res.message) {
      notification.info({
        message: 'Row delete failed',
        description: h('div', {
          innerHTML: `<div style="padding:10px 4px">Unable to delete row with ID ${id} because of the following:
                <br><br>${res.message.join('<br>')}<br><br>
                Clear the data first & try again</div>`,
        }),
      })
      return false
    }
    return true
  }

  const deleteRow = async (rowIndex: number) => {
    try {
      const row = formattedData.value[rowIndex]
      if (!row.rowMeta.new) {
        const id = meta?.value?.columns
          ?.filter((c) => c.pk)
          .map((c) => row.row[c.title as any])
          .join('___')

        const deleted = await deleteRowById(id as string)
        if (!deleted) {
          return
        }
      }
      formattedData.value.splice(rowIndex, 1)
      syncCount()
    } catch (e: any) {
      notification.error({
        message: 'Failed to delete row',
        description: await extractSdkResponseErrorMsg(e),
      })
    }
  }

  const deleteSelectedRows = async () => {
    let row = formattedData.value.length
    while (row--) {
      try {
        const { row: rowObj, rowMeta } = formattedData.value[row] as Record<string, any>
        if (!rowMeta.selected) {
          continue
        }
        if (!rowMeta.new) {
          const id = meta?.value?.columns
            ?.filter((c) => c.pk)
            .map((c) => rowObj[c.title as string])
            .join('___')

          const successfulDeletion = await deleteRowById(id as string)
          if (!successfulDeletion) {
            continue
          }
        }
        formattedData.value.splice(row, 1)
      } catch (e: any) {
        return notification.error({
          message: 'Failed to delete row',
          description: await extractSdkResponseErrorMsg(e),
        })
      }
    }
    syncCount()
  }

  const loadFormView = async () => {
    if (!viewMeta?.value?.id) return
    try {
      const { columns, ...view } = (await $api.dbView.formRead(viewMeta.value.id)) as Record<string, any>

      const fieldById = columns.reduce(
        (o: Record<string, any>, f: Record<string, any>) => ({
          ...o,
          [f.fk_column_id]: f,
        }),
        {},
      )

      let order = 1

      formViewData.value = view

      formColumnData.value = meta?.value?.columns
        ?.map((c: Record<string, any>) => ({
          ...c,
          fk_column_id: c.id,
          fk_view_id: viewMeta.value.id,
          ...(fieldById[c.id] ? fieldById[c.id] : {}),
          order: (fieldById[c.id] && fieldById[c.id].order) || order++,
          id: fieldById[c.id] && fieldById[c.id].id,
        }))
        .sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order) as Record<string, any>
    } catch (e: any) {
      return notification.error({
        message: 'Failed to set form data',
        description: await extractSdkResponseErrorMsg(e),
      })
    }
  }

  const updateFormView = async (view: FormType | undefined) => {
    try {
      if (!viewMeta?.value?.id || !view) return
      await $api.dbView.formUpdate(viewMeta.value.id, view)
    } catch (e: any) {
      return notification.error({
        message: 'Failed to update form view',
        description: await extractSdkResponseErrorMsg(e),
      })
    }
  }

  return {
    loadData,
    paginationData,
    queryParams,
    formattedData,
    insertRow,
    updateRowProperty,
    changePage,
    addEmptyRow,
    deleteRow,
    deleteSelectedRows,
    updateOrSaveRow,
    selectedAllRecords,
    syncCount,
    galleryData,
    loadGalleryData,
    loadFormView,
    formColumnData,
    formViewData,
    updateFormView,
    aggCommentCount,
    loadAggCommentsCount,
  }
}
