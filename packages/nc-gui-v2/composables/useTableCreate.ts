import type { TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { useProject } from './useProject'
import { useNuxtApp } from '#app'

export function useTableCreate(onTableCreate?: (tableMeta: TableType) => void) {
  const table = reactive<{ title: string; table_name: string; columns: string[] }>({
    title: '',
    table_name: '',
    columns: ['id', 'title', 'created_at', 'updated_at'],
  })

  const { sqlUi, project, tables } = useProject()
  const { $api } = useNuxtApp()

  const createTable = async () => {
    if (!sqlUi?.value) return
    const columns = sqlUi?.value?.getNewTableColumns().filter((col) => {
      if (col.column_name === 'id' && table.columns.includes('id_ag')) {
        Object.assign(col, sqlUi?.value?.getDataTypeForUiType({ uidt: UITypes.ID }, 'AG'))
        col.dtxp = sqlUi?.value?.getDefaultLengthForDatatype(col.dt)
        col.dtxs = sqlUi?.value?.getDefaultScaleForDatatype(col.dt)
        return true
      }
      return table.columns.includes(col.column_name)
    })

    const tableMeta = await $api.dbTable.create(project?.value?.id as string, {
      ...table,
      columns,
    })

    onTableCreate?.(tableMeta)
  }

  watch(
    () => table.title,
    (title) => {
      table.table_name = `${project?.value?.prefix || ''}${title}`
    },
  )

  const generateUniqueTitle = () => {
    let c = 1
    while (tables?.value?.some((t) => t.title === `Sheet${c}`)) {
      c++
    }
    table.title = `Sheet${c}`
  }

  return { table, createTable, generateUniqueTitle, tables, project }
}
