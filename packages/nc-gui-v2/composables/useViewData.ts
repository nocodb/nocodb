import type { Api, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { notification } from 'ant-design-vue'
import { useNuxtApp } from '#app'
import { useProject } from '#imports'
import { NOCO } from '~/lib'
import { extractSdkResponseErrorMsg } from '~/utils'

const formatData = (list: Record<string, any>[]) =>
  list.map((row) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {},
  }))

interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta?: any
}

export function useViewData(
  meta: Ref<TableType> | ComputedRef<TableType> | undefined,
  viewMeta: Ref<ViewType & { id: string }> | ComputedRef<ViewType & { id: string }> | undefined,
  where?: ComputedRef<string | undefined>,
) {
  const formattedData = ref<Row[]>([])
  const paginationData = ref<PaginatedType>({ page: 1, pageSize: 25 })

  const { project } = useProject()
  const { $api } = useNuxtApp()

  const selectedAllRecords = computed({
    get() {
      return formattedData.value.every((row) => row.rowMeta.selected)
    },
    set(selected) {
      formattedData.value.forEach((row) => (row.rowMeta.selected = selected))
    },
  })

  const loadData = async (params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) => {
    if (!project?.value?.id || !meta?.value?.id || !viewMeta?.value?.id) return
    const response = await $api.dbViewRow.list('noco', project.value.id, meta.value.id, viewMeta.value.id, {
      ...params,
      where: where?.value,
    })
    formattedData.value = formatData(response.list)
    paginationData.value = response.pageInfo
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
    formattedData.value[addAfter] = {
      row: {},
      oldRow: {},
      rowMeta: { new: true },
    }
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
      if (!row.rowMeta.new){
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
        const { row: rowObj, rowMeta } = formattedData.value[row]
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
  }

  return {
    loadData,
    paginationData,
    formattedData,
    insertRow,
    updateRowProperty,
    changePage,
    addEmptyRow,
    deleteRow,
    deleteSelectedRows,
    updateOrSaveRow,
    selectedAllRecords,
  }
}
