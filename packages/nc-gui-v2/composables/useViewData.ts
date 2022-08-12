import type { Api, ColumnType, FormType, GalleryType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { message } from 'ant-design-vue'
import { IsPublicInj, NOCO, computed, extractPkFromRow, extractSdkResponseErrorMsg, ref, useNuxtApp, useProject } from '#imports'

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
    selected?: boolean
    commentCount?: number
  }
}
const formattedData = ref<Row[]>([])

export function useViewData(
  meta: Ref<TableType> | ComputedRef<TableType> | undefined,
  viewMeta: Ref<ViewType & { id: string }> | ComputedRef<ViewType & { id: string }> | undefined,
  where?: ComputedRef<string | undefined>,
) {
  if (!meta) {
    throw new Error('Table meta is not available')
  }

  const _paginationData = ref<PaginatedType>({ page: 1, pageSize: 25 })
  const aggCommentCount = ref<{ row_id: string; count: number }[]>([])
  const galleryData = ref<GalleryType>()
  const formColumnData = ref<FormType>()
  // todo: missing properties on FormType (success_msg, show_blank_form,
  const formViewData = ref<FormType & { success_msg?: string; show_blank_form?: boolean }>()

  const isPublic = inject(IsPublicInj, ref(false))
  const { project } = useProject()
  const { fetchSharedViewData, paginationData: sharedPaginationData } = useSharedView()
  const { $api } = useNuxtApp()

  const paginationData = computed({
    get: () => (isPublic.value ? sharedPaginationData.value : _paginationData.value),
    set: (value) => {
      if (isPublic.value) {
        sharedPaginationData.value = value
      } else {
        _paginationData.value = value
      }
    },
  })

  const selectedAllRecords = computed({
    get() {
      return !!formattedData.value.length && formattedData.value.every((row: Row) => row.rowMeta.selected)
    },
    set(selected: boolean) {
      formattedData.value.forEach((row: Row) => (row.rowMeta.selected = selected))
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
    if (isPublic.value) return

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
    if ((!project?.value?.id || !meta?.value?.id || !viewMeta?.value?.id) && !isPublic.value) return

    const response = !isPublic.value
      ? await $api.dbViewRow.list('noco', project.value.id, meta.value.id, viewMeta.value.id, {
          ...params,
          where: where?.value,
        })
      : await fetchSharedViewData()
    formattedData.value = formatData(response.list)
    paginationData.value = response.pageInfo

    await loadAggCommentsCount()
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

      await syncCount()
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
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
    } catch (e: any) {
      message.error(`Row update failed ${await extractSdkResponseErrorMsg(e)}`)
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
      message.info(
        `Row delete failed: ${h('div', {
          innerHTML: `<div style="padding:10px 4px">Unable to delete row with ID ${id} because of the following:
              <br><br>${res.message.join('<br>')}<br><br>
              Clear the data first & try again</div>`,
        })}`,
      )
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

      await syncCount()
    } catch (e: any) {
      message.error(`Failed to delete row: ${await extractSdkResponseErrorMsg(e)}`)
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
        return message.error(`Failed to delete row: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    await syncCount()
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
      return message.error(`Failed to set form data: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  const updateFormView = async (view: FormType | undefined) => {
    try {
      if (!viewMeta?.value?.id || !view) return
      await $api.dbView.formUpdate(viewMeta.value.id, view)
    } catch (e: any) {
      return message.error(`Failed to update form view: ${await extractSdkResponseErrorMsg(e)}`)
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
